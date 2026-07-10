import { randomBytes } from 'node:crypto';
import type { BridgeCommandInput, BridgeReply, WireFetchCommand, WireReply } from '@maple/shared';

// ===== 넥슨 API 지식의 단일 소유처 =====
// 확장(웹스토어 심사 필요)에 있던 헤더 구성이 여기로 왔다.
// 넥슨이 x-client-version을 올리거나 헤더를 바꾸면 이 파일만 고치고 npm 릴리스하면 끝.

// api.mskr.nexon.com은 실제 웹 거래소가 보내는 클라이언트 식별 헤더를 요구한다.
// 이게 없으면 쿠키가 유효해도 426(Upgrade Required)으로 튕긴다. 실측값: docs/API.md.
// origin/referer는 브라우저 fetch가 설정 금지라 확장 쪽에서 못 싣지만, 확장의 host 권한이
// CORS를 우회하므로 x-platform / x-device-id / x-client-version / accept만으로 게이트를 통과한다.
const DEVICE_ID = randomBytes(16).toString('hex');

export function nexonHeaders(hasBody = false): Record<string, string> {
  const h: Record<string, string> = {
    accept: 'application/json, text/plain, */*',
    'x-platform': 'PC_WEB',
    'x-device-id': DEVICE_ID,
    // 이게 없으면 426. 웹 거래소가 보내는 실측값(2026-07-09).
    'x-client-version': '1.0.1',
  };
  if (hasBody) h['Content-Type'] = 'application/json';
  return h;
}

// mcp.ts·characters.ts가 소비하는 내부 API. (mcp.ts에 있던 것을 이동 — 순환 import 방지)
export interface BridgeLike {
  readonly connected: boolean;
  request(cmd: BridgeCommandInput, timeoutMs?: number): Promise<BridgeReply>;
}

// 와이어 프레임을 나르는 전송 계층 (구현: bridge.ts의 Bridge)
export interface WireTransport {
  readonly connected: boolean;
  request(cmd: Omit<WireFetchCommand, 'id'>, timeoutMs?: number): Promise<WireReply>;
  close?(): Promise<void>;
}

// 내부 API(객체 바디, 파싱된 data) ↔ 와이어 v2(헤더 포함, 문자열 바디, 원문 응답)의 단일 변환점.
// 도구 구현부(mcp.ts)는 와이어 형식을 모른다 — 프로토콜이 바뀌면 여기만 고친다.
export class NexonBridge implements BridgeLike {
  constructor(private transport: WireTransport) {}

  get connected(): boolean {
    return this.transport.connected;
  }

  async request(cmd: BridgeCommandInput, timeoutMs?: number): Promise<BridgeReply> {
    const hasBody = cmd.body != null;
    const wire: Omit<WireFetchCommand, 'id'> = {
      type: 'fetch',
      url: cmd.url,
      method: cmd.method,
      headers: { ...nexonHeaders(hasBody), ...(cmd.headers ?? {}) },
      ...(hasBody ? { body: JSON.stringify(cmd.body) } : {}),
      ...(cmd.fanout ? { fanout: true } : {}),
    };
    const w = await this.transport.request(wire, timeoutMs);
    // 구버전 확장의 res.json().catch(()=>null)과 동일한 관용: 비JSON은 null
    const data = w.bodyText != null ? parseJson(w.bodyText) : undefined;
    return w.ok
      ? { id: w.id, ok: true, status: w.status, data }
      : { id: w.id, ok: false, code: w.code, error: w.error, status: w.status, data };
  }

  close(): Promise<void> {
    return this.transport.close?.() ?? Promise.resolve();
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
