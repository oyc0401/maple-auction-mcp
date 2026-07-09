import { describe, it, expect, afterEach } from 'vitest';
import WebSocket from 'ws';
import { Bridge } from '../src/bridge.js';
import { Broker } from '../src/broker.js';

const TEST_PORT = 29973;
let bridge: Bridge;
let broker: Broker | undefined;

afterEach(async () => {
  await bridge?.close();
  await broker?.close();
  broker = undefined;
});

function connectExtension(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`, { origin: 'chrome-extension://x' });
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

// bridge가 브로커 소켓에 붙고 상태를 받을 때까지 잠깐 대기
const settle = () => new Promise((r) => setTimeout(r, 150));

describe('Bridge (client)', () => {
  it('브로커에 확장이 있으면 connected=true, 왕복 요청이 동작한다', async () => {
    broker = new Broker(TEST_PORT);
    const ext = await connectExtension();
    ext.on('message', (raw) => {
      const cmd = JSON.parse(raw.toString());
      if (cmd.keepalive) return;
      ext.send(JSON.stringify({ id: cmd.id, ok: true, status: 200, bodyText: cmd.url }));
    });
    bridge = new Bridge(TEST_PORT);
    await settle();
    expect(bridge.connected).toBe(true);
    const reply = await bridge.request({ type: 'fetch', url: 'https://x', method: 'GET', headers: {} });
    expect(reply.ok).toBe(true);
    if (reply.ok) expect(reply.bodyText).toBe('https://x');
    ext.close();
  });

  it('브로커는 있지만 확장이 없으면 connected=false, 요청은 DISCONNECTED', async () => {
    broker = new Broker(TEST_PORT);
    bridge = new Bridge(TEST_PORT);
    await settle();
    expect(bridge.connected).toBe(false);
    const reply = await bridge.request({ type: 'fetch', url: 'https://x', method: 'GET', headers: {} });
    expect(reply.ok).toBe(false);
    if (!reply.ok) expect(reply.code).toBe('DISCONNECTED');
  });

  it('확장이 붙으면 bridgeStatus로 connected가 true로 바뀐다', async () => {
    broker = new Broker(TEST_PORT);
    bridge = new Bridge(TEST_PORT);
    await settle();
    expect(bridge.connected).toBe(false);
    const ext = await connectExtension();
    await settle();
    expect(bridge.connected).toBe(true);
    ext.close();
  });
});
