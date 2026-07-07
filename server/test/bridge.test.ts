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

// discover엔 identity(또는 NO_IDENTITY), 그 외(fetch)엔 tag를 응답하는 가짜 확장
function respondAs(ws: WebSocket, opts: { identity?: unknown; fetchTag?: string; onFetch?: () => void }): void {
  ws.on('message', (raw) => {
    const cmd = JSON.parse(raw.toString());
    if (cmd.type === 'discover') {
      ws.send(
        JSON.stringify(
          opts.identity != null
            ? { id: cmd.id, ok: true, data: opts.identity }
            : { id: cmd.id, ok: false, code: 'NO_IDENTITY', error: 'no' }
        )
      );
    } else {
      opts.onFetch?.();
      ws.send(JSON.stringify({ id: cmd.id, ok: true, data: opts.fetchTag ?? 'fetch' }));
    }
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

  it('여러 확장 중 로그인된(identity 반환) 확장을 골라 discover한다 (마지막 연결이 아님)', async () => {
    bridge = new Bridge(TEST_PORT);
    // 로그인된 확장을 먼저 붙이고, 로그아웃 확장을 나중에 붙인다.
    // last-wins였다면 로그아웃 확장이 이겨서 실패할 조건.
    const loggedIn = await connectClient();
    const loggedOut = await connectClient();
    respondAs(loggedIn, { identity: { worldId: 5, accountId: 1, characterId: 2 } });
    respondAs(loggedOut, {});
    const reply = await bridge.request({ type: 'discover' });
    expect(reply.ok).toBe(true);
    if (reply.ok) expect(reply.data).toMatchObject({ worldId: 5, characterId: 2 });
    loggedIn.close();
    loggedOut.close();
  });

  it('discover가 고른 확장으로만 이후 fetch를 보낸다', async () => {
    bridge = new Bridge(TEST_PORT);
    const loggedIn = await connectClient();
    const loggedOut = await connectClient();
    let loggedOutGotFetch = false;
    respondAs(loggedIn, { identity: { worldId: 5, accountId: 1, characterId: 2 }, fetchTag: 'from-logged-in' });
    respondAs(loggedOut, { fetchTag: 'from-logged-out', onFetch: () => (loggedOutGotFetch = true) });
    await bridge.request({ type: 'discover' });
    const reply = await bridge.request({ type: 'fetch', url: 'https://x', method: 'GET' });
    expect(reply.ok && reply.data).toBe('from-logged-in');
    expect(loggedOutGotFetch).toBe(false); // 로그아웃 확장엔 검색 요청이 가지 않음 (검색 횟수 중복 소진 방지)
    loggedIn.close();
    loggedOut.close();
  });

  it('모든 확장이 로그인 안 됐으면 NO_IDENTITY를 반환한다', async () => {
    bridge = new Bridge(TEST_PORT);
    const a = await connectClient();
    const b = await connectClient();
    respondAs(a, {});
    respondAs(b, {});
    const reply = await bridge.request({ type: 'discover' });
    expect(reply.ok).toBe(false);
    if (!reply.ok) expect(reply.code).toBe('NO_IDENTITY');
    a.close();
    b.close();
  });
});
