// ===== Maple Auction Bridge — background service worker =====
import { BRIDGE_PORT, PROTOCOL_VERSION, type WireFetchCommand, type ExtensionHello } from '@maple/shared';
import { executeFetch } from './api.js';

// 로드된 코드 버전을 SW 콘솔에 남긴다(예전/지금 코드 구분용). 버전 출처는 manifest.
console.info(`[maple-bridge] service worker loaded — v${chrome.runtime.getManifest().version}`);

let ws: WebSocket | null = null;
let keepalive: ReturnType<typeof setInterval> | null = null;

async function handleCommand(cmd: WireFetchCommand): Promise<unknown> {
  if (cmd.type === 'fetch') return executeFetch(cmd);
  // 알 수 없는 커맨드(미래 프로토콜) — 기계 코드만 돌려주고 해석은 서버가 한다
  return { id: cmd.id, ok: false, code: 'NETWORK', error: `unknown command: ${(cmd as { type?: string }).type}` };
}

// 소켓이 열려있을 때만 보낸다. await 사이에 소켓이 CLOSING/CLOSED로 바뀌면
// ws.send()가 동기 예외를 던지는데(옵셔널 체이닝으론 못 거름) 그게 SW 크래시로 번지므로 여기서 삼킨다.
function safeSend(data: unknown): void {
  if (ws?.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(data));
  } catch {
    /* 그 찰나에 소켓이 닫힘 — 무시 */
  }
}

function connect(): void {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  ws = new WebSocket(`ws://127.0.0.1:${BRIDGE_PORT}`);

  ws.onopen = () => {
    // 프로토콜 핸드셰이크: 다른 어떤 메시지보다 먼저 버전을 알린다 (브로커가 호환성 판정에 사용)
    const hello: ExtensionHello = {
      type: 'hello',
      protocolVersion: PROTOCOL_VERSION,
      extensionVersion: chrome.runtime.getManifest().version,
    };
    safeSend(hello);
    // MV3 SW keepalive: 20초마다 트래픽을 발생시켜 SW 수면을 막는다
    keepalive = setInterval(() => safeSend({ keepalive: true }), 20_000);
  };

  ws.onmessage = async (ev) => {
    try {
      const cmd = JSON.parse(String(ev.data)) as WireFetchCommand;
      const reply = await handleCommand(cmd);
      safeSend(reply);
    } catch {
      /* 파싱/처리 실패가 unhandled rejection으로 번지지 않게 삼킨다 */
    }
  };

  ws.onclose = () => {
    if (keepalive) clearInterval(keepalive);
    keepalive = null;
    ws = null;
  };
  ws.onerror = () => ws?.close();
}

// 복구 메커니즘을 먼저 등록한다. connect()가 어떤 이유로 던지더라도
// 알람·리스너는 이미 무장돼 다음 주기(30초)에 재시도된다.
// 켤 때 + 30초마다 재접속 시도 (서버가 늦게 뜰 수 있음)
chrome.alarms.create('reconnect', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === 'reconnect') connect();
});
chrome.runtime.onStartup.addListener(connect);
chrome.runtime.onInstalled.addListener(connect);

// 전역 안전망: 어떤 stray 에러도 오류 뱃지/크래시로 번지지 않게 하고, 끊겼으면 재접속.
self.addEventListener('unhandledrejection', (e) => {
  e.preventDefault();
  connect();
});
self.addEventListener('error', (e) => {
  e.preventDefault?.();
});

connect();
