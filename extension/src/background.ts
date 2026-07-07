import { BRIDGE_PORT, type BridgeCommand } from '@maple/shared';
import { executeFetch, discoverIdentity } from './api.js';

let ws: WebSocket | null = null;
let keepalive: ReturnType<typeof setInterval> | null = null;

async function handleCommand(cmd: BridgeCommand): Promise<unknown> {
  if (cmd.type === 'fetch') return executeFetch(cmd);
  if (cmd.type === 'discover') {
    const r = await discoverIdentity();
    return { ...r, id: cmd.id };
  }
  return { id: (cmd as { id: string }).id, ok: false, code: 'NETWORK', error: 'unknown command' };
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
    // MV3 SW keepalive: 20초마다 트래픽을 발생시켜 SW 수면을 막는다
    keepalive = setInterval(() => safeSend({ keepalive: true }), 20_000);
  };

  ws.onmessage = async (ev) => {
    try {
      const cmd = JSON.parse(String(ev.data)) as BridgeCommand;
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
