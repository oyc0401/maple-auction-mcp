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

function connect(): void {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  ws = new WebSocket(`ws://127.0.0.1:${BRIDGE_PORT}`);

  ws.onopen = () => {
    // MV3 SW keepalive: 20초마다 트래픽을 발생시켜 SW 수면을 막는다
    keepalive = setInterval(() => ws?.send(JSON.stringify({ keepalive: true })), 20_000);
  };

  ws.onmessage = async (ev) => {
    let cmd: BridgeCommand;
    try {
      cmd = JSON.parse(String(ev.data));
    } catch {
      return;
    }
    const reply = await handleCommand(cmd);
    ws?.send(JSON.stringify(reply));
  };

  ws.onclose = () => {
    if (keepalive) clearInterval(keepalive);
    keepalive = null;
    ws = null;
  };
  ws.onerror = () => ws?.close();
}

// 켜질 때 + 30초마다 재접속 시도 (서버가 늦게 뜰 수 있음)
connect();
chrome.runtime.onStartup.addListener(connect);
chrome.runtime.onInstalled.addListener(connect);
chrome.alarms.create('reconnect', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === 'reconnect') connect();
});
