// maplescouter(환산 계산기) 호출을 브라우저 확장(bridge)으로 우회하는 배관.
// 왜: maplescouter는 Cloudflare 봇 차단으로 서버의 직접 fetch를 403으로 막는다(실측 2026-07-11 —
// api-key 무관, UA/브라우저 헤더 무관, 사이트 루트까지 403). 실제 브라우저(확장)만 CF를 통과하므로
// 넥슨 API와 동일하게 확장을 경유시킨다. hwansan2/scouterClient는 fetch 형태만 알면 되도록 어댑터로 감싼다.
import {
  SCOUTER_BLOCKED_MSG,
  SCOUTER_EXT_OUTDATED_MSG,
  DISCONNECTED_MSG,
} from '@maple/shared';
import type { BridgeLike } from './nexon.js';

// BridgeLike를 scouterClient가 기대하는 fetch(url, init) 형태로 감싼다.
// 반환 Response는 scouterClient가 쓰는 최소 표면(ok/status/json/text)만 구현한다.
export function bridgeScouterFetch(bridge: BridgeLike): typeof fetch {
  return (async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = String(input);
    const method = (init.method ?? 'GET') as 'GET' | 'POST' | 'DELETE';
    // 전제: 유일한 호출자(hwansan2/scouterClient)가 headers를 평범한 객체 리터럴로 넘긴다
    // (Headers 인스턴스·[k,v][] 형태는 오지 않는다). body도 항상 JSON.stringify 결과다.
    const headers = (init.headers as Record<string, string> | undefined) ?? undefined;
    // scouterClient는 body를 JSON 문자열로 넘긴다 → 객체로 되돌려 bridge에 싣는다(NexonBridge가 다시 직렬화).
    const body = typeof init.body === 'string' && init.body.length ? JSON.parse(init.body) : undefined;

    const reply = await bridge.request({ type: 'fetch', url, method, headers, body });
    if (reply.ok) {
      return responseLike(true, reply.status ?? 200, reply.data);
    }
    // HTTP 4xx/5xx는 Response(!ok)로 되돌려 scouterClient의 `if (!res.ok) throw ...` 경로가 status로 판단(403=CF).
    if (reply.code === 'HTTP_ERROR') {
      return responseLike(false, reply.status ?? 0, reply.data);
    }
    // 전송 자체 실패(미연결·허용목록 위반·타임아웃·네트워크)는 예외로 — scouterErrorText가 안내로 변환.
    throw new Error(`${reply.code}: ${reply.error}`);
  }) as unknown as typeof fetch;
}

function responseLike(ok: boolean, status: number, data: unknown): Response {
  return {
    ok,
    status,
    json: async () => data,
    text: async () => (typeof data === 'string' ? data : JSON.stringify(data ?? '')),
  } as Response;
}

// scouter 호출 실패(fetchScouter/simulate가 던진 예외)를 AI가 읽을 행동 지시로 변환한다.
// scouterClient는 `scouter <path> <status>` 형태로, bridgeScouterFetch는 `<code>: <error>` 형태로 던진다.
export function scouterErrorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/\b403\b/.test(msg)) return SCOUTER_BLOCKED_MSG; // Cloudflare 봇 차단
  if (msg.includes('FORBIDDEN_URL') || msg.includes('허용되지 않은 URL')) return SCOUTER_EXT_OUTDATED_MSG;
  if (msg.includes('DISCONNECTED')) return DISCONNECTED_MSG; // 확장 미연결
  return `환산 계산기(maplescouter) 호출 실패: ${msg}`;
}
