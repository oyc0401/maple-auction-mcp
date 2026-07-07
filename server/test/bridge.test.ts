import { describe, it, expect, afterEach } from 'vitest';
import WebSocket from 'ws';
import { Bridge } from '../src/bridge.js';

const TEST_PORT = 29971;
let bridge: Bridge;

afterEach(async () => {
  await bridge?.close();
});

function connectClient(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

describe('Bridge', () => {
  it('미연결이면 즉시 DISCONNECTED를 반환한다', async () => {
    bridge = new Bridge(TEST_PORT);
    const reply = await bridge.request({ type: 'discover' });
    expect(reply.ok).toBe(false);
    if (!reply.ok) expect(reply.code).toBe('DISCONNECTED');
  });

  it('클라이언트가 응답하면 그 응답을 돌려준다', async () => {
    bridge = new Bridge(TEST_PORT);
    const ws = await connectClient();
    ws.on('message', (raw) => {
      const cmd = JSON.parse(raw.toString());
      ws.send(JSON.stringify({ id: cmd.id, ok: true, status: 200, data: { hello: 1 } }));
    });
    const reply = await bridge.request({ type: 'fetch', url: 'https://x', method: 'GET' });
    expect(reply.ok).toBe(true);
    if (reply.ok) expect(reply.data).toEqual({ hello: 1 });
    ws.close();
  });

  it('응답이 없으면 TIMEOUT을 반환한다', async () => {
    bridge = new Bridge(TEST_PORT);
    const ws = await connectClient(); // 메시지 무시
    const reply = await bridge.request({ type: 'discover' }, 200);
    expect(reply.ok).toBe(false);
    if (!reply.ok) expect(reply.code).toBe('TIMEOUT');
    ws.close();
  });

  it('웹페이지(http origin) 접속은 거부한다 (CSWSH 방지)', async () => {
    bridge = new Bridge(TEST_PORT);
    await expect(
      new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`, { origin: 'https://evil.example.com' });
        ws.on('open', () => resolve('open'));
        ws.on('error', reject);
      })
    ).rejects.toThrow();
  });

  it('새 연결이 오면 이전 연결을 대체한다', async () => {
    bridge = new Bridge(TEST_PORT);
    const first = await connectClient();
    const second = await connectClient();
    second.on('message', (raw) => {
      const cmd = JSON.parse(raw.toString());
      second.send(JSON.stringify({ id: cmd.id, ok: true, data: 'second' }));
    });
    const reply = await bridge.request({ type: 'discover' });
    expect(reply.ok && reply.data).toBe('second');
    first.close();
    second.close();
  });
});
