import { describe, it, expect, afterEach } from 'vitest';
import WebSocket from 'ws';
import { Broker } from '../src/broker.js';

const TEST_PORT = 29972;
let broker: Broker;

afterEach(async () => {
  await broker?.close();
});

// origin 'chrome-extension://x'로 붙는 가짜 확장
function connectExtension(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`, { origin: 'chrome-extension://x' });
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function respondAs(ws: WebSocket, opts: { identity?: unknown; fetchTag?: string; onFetch?: () => void }): void {
  ws.on('message', (raw) => {
    const cmd = JSON.parse(raw.toString());
    if (cmd.keepalive) return;
    if (cmd.type === 'discover') {
      ws.send(JSON.stringify(
        opts.identity != null
          ? { id: cmd.id, ok: true, data: opts.identity }
          : { id: cmd.id, ok: false, code: 'NO_IDENTITY', error: 'no' }
      ));
    } else {
      opts.onFetch?.();
      ws.send(JSON.stringify({ id: cmd.id, ok: true, data: opts.fetchTag ?? 'fetch' }));
    }
  });
}

describe('Broker — 확장 라우팅', () => {
  it('확장 미연결이면 즉시 DISCONNECTED', async () => {
    broker = new Broker(TEST_PORT);
    const reply = await broker.request({ type: 'discover' });
    expect(reply.ok).toBe(false);
    if (!reply.ok) expect(reply.code).toBe('DISCONNECTED');
  });

  it('확장이 응답하면 그 응답을 돌려준다', async () => {
    broker = new Broker(TEST_PORT);
    const ws = await connectExtension();
    ws.on('message', (raw) => {
      const cmd = JSON.parse(raw.toString());
      ws.send(JSON.stringify({ id: cmd.id, ok: true, status: 200, data: { hello: 1 } }));
    });
    const reply = await broker.request({ type: 'fetch', url: 'https://x', method: 'GET' });
    expect(reply.ok).toBe(true);
    if (reply.ok) expect(reply.data).toEqual({ hello: 1 });
    ws.close();
  });

  it('응답이 없으면 TIMEOUT', async () => {
    broker = new Broker(TEST_PORT);
    const ws = await connectExtension(); // 메시지 무시
    const reply = await broker.request({ type: 'discover' }, 200);
    expect(reply.ok).toBe(false);
    if (!reply.ok) expect(reply.code).toBe('TIMEOUT');
    ws.close();
  });

  it('웹페이지(http origin) 접속은 거부한다 (CSWSH 방지)', async () => {
    broker = new Broker(TEST_PORT);
    await expect(
      new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`, { origin: 'https://evil.example.com' });
        ws.on('open', () => resolve('open'));
        ws.on('error', reject);
      })
    ).rejects.toThrow();
  });

  it('다중 확장 중 로그인된 확장을 discover가 고른다 (마지막 연결 아님)', async () => {
    broker = new Broker(TEST_PORT);
    const loggedIn = await connectExtension();
    const loggedOut = await connectExtension();
    respondAs(loggedIn, { identity: { worldId: 5, accountId: 1, characterId: 2 } });
    respondAs(loggedOut, {});
    const reply = await broker.request({ type: 'discover' });
    expect(reply.ok).toBe(true);
    if (reply.ok) expect(reply.data).toMatchObject({ worldId: 5, characterId: 2 });
    loggedIn.close();
    loggedOut.close();
  });

  it('discover가 고른 확장으로만 이후 fetch를 보낸다', async () => {
    broker = new Broker(TEST_PORT);
    const loggedIn = await connectExtension();
    const loggedOut = await connectExtension();
    let loggedOutGotFetch = false;
    respondAs(loggedIn, { identity: { worldId: 5, accountId: 1, characterId: 2 }, fetchTag: 'from-logged-in' });
    respondAs(loggedOut, { fetchTag: 'from-logged-out', onFetch: () => (loggedOutGotFetch = true) });
    await broker.request({ type: 'discover' });
    const reply = await broker.request({ type: 'fetch', url: 'https://x', method: 'GET' });
    expect(reply.ok && reply.data).toBe('from-logged-in');
    expect(loggedOutGotFetch).toBe(false);
    loggedIn.close();
    loggedOut.close();
  });

  it('모든 확장이 로그아웃이면 NO_IDENTITY', async () => {
    broker = new Broker(TEST_PORT);
    const a = await connectExtension();
    const b = await connectExtension();
    respondAs(a, {});
    respondAs(b, {});
    const reply = await broker.request({ type: 'discover' });
    expect(reply.ok).toBe(false);
    if (!reply.ok) expect(reply.code).toBe('NO_IDENTITY');
    a.close();
    b.close();
  });
});
