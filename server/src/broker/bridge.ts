import { WebSocket } from 'ws';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import {
  BRIDGE_PORT,
  DISCONNECTED_MSG,
  type WireFetchCommand,
  type WireReply,
  type BridgeServerMessage,
} from '@maple/shared';

// 브로커에 붙는 얇은 WS 클라이언트. 확장 선택(fanout)은 브로커가 담당한다.
// 브로커가 없으면 한 번 자동 스폰하고 재접속한다.
// WireTransport 구현체 — 내부 API 변환은 AuctionBridge가 한다.
export class Bridge {
  private port: number;
  private ws: WebSocket | null = null;
  private extPresent = false;
  private spawned = false;
  private closed = false;
  private pending = new Map<string, { resolve: (r: WireReply) => void; timer: NodeJS.Timeout }>();
  private ready: Promise<void>;
  private resolveReady!: () => void;

  constructor(port: number = BRIDGE_PORT) {
    this.port = port;
    this.ready = new Promise((r) => (this.resolveReady = r));
    this.connect();
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.extPresent;
  }

  private connect(): void {
    if (this.closed) return;
    const ws = new WebSocket(`ws://127.0.0.1:${this.port}`); // origin 없음 → 브로커가 클라이언트로 인식
    this.ws = ws;
    ws.on('open', () => {
      this.spawned = false;
      this.resolveReady();
    });
    ws.on('message', (raw) => this.onMessage(raw.toString()));
    ws.on('error', () => {
      /* close 이벤트에서 재접속 처리 */
    });
    ws.on('close', () => {
      if (this.ws === ws) {
        this.ws = null;
        this.extPresent = false;
      }
      if (!this.closed) this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    // 첫 접속 실패(브로커 없음)면 브로커를 한 번 스폰한다.
    if (!this.spawned) {
      this.spawned = true;
      this.spawnBroker();
    }
    setTimeout(() => this.connect(), 300);
  }

  private spawnBroker(): void {
    try {
      // 번들 실행(dist)에선 형제 broker.js. tsx로 소스(src)를 직접 실행하는 개발 환경엔 .js가 없어
      // 스폰이 조용히 실패하고 포트가 영영 안 열린다 — dist/broker.js로 폴백 (실측 2026-07-11).
      let brokerPath = fileURLToPath(new URL('./broker.js', import.meta.url));
      if (!existsSync(brokerPath)) brokerPath = fileURLToPath(new URL('../../dist/broker.js', import.meta.url));
      if (!existsSync(brokerPath)) {
        process.stderr.write('[bridge] broker.js를 찾지 못했습니다 — `node build.mjs`로 빌드하세요\n');
        return;
      }
      spawn(process.execPath, [brokerPath], { detached: true, stdio: 'ignore' }).unref();
    } catch (err) {
      process.stderr.write(`[bridge] broker spawn 실패: ${(err as Error).message}\n`);
    }
  }

  private onMessage(raw: string): void {
    let msg: BridgeServerMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if ('type' in msg) {
      // BridgeStatus (확장 연결 유무 통지). BridgeReply엔 type이 없다.
      this.extPresent = msg.extension;
      return;
    }
    if (!msg.id) return;
    const p = this.pending.get(msg.id);
    if (!p) return;
    this.pending.delete(msg.id);
    clearTimeout(p.timer);
    p.resolve(msg);
  }

  async request(cmd: Omit<WireFetchCommand, 'id'>, timeoutMs = 15000): Promise<WireReply> {
    // 콜드 스타트 오탐 방지: 최초 접속을 잠깐 기다린다(최대 2s).
    await Promise.race([this.ready, new Promise((r) => setTimeout(r, 2000))]);
    if (!this.connected) {
      return { id: '', ok: false, code: 'DISCONNECTED', error: DISCONNECTED_MSG };
    }
    const id = randomUUID();
    const ws = this.ws!;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({ id, ok: false, code: 'TIMEOUT', error: `확장 응답 시간 초과 (${timeoutMs}ms)` });
      }, timeoutMs);
      this.pending.set(id, { resolve, timer });
      ws.send(JSON.stringify({ ...cmd, id }));
    });
  }

  close(): Promise<void> {
    this.closed = true;
    for (const [, p] of this.pending) clearTimeout(p.timer);
    this.pending.clear();
    this.ws?.close();
    this.ws = null;
    return Promise.resolve();
  }
}
