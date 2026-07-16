import { describe, it, expect, afterEach } from 'vitest';
import WebSocket from 'ws';
import { PROTOCOL_VERSION, type WireFetchCommand } from '@maple/shared';
import { Broker } from './broker.js';

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

// fanout 프로브 (구 discover 대체): 브로커가 모든 확장에 뿌려 첫 성공을 preferred로 고정
function probe(): Omit<WireFetchCommand, 'id'> {
  return { type: 'fetch', url: 'https://api.mskr.nexon.com/v1/accounts', method: 'GET', headers: {}, fanout: true };
}

function fetchCmd(url = 'https://x'): Omit<WireFetchCommand, 'id'> {
  return { type: 'fetch', url, method: 'GET', headers: {} };
}

// 가짜 확장: fanout 프로브엔 로그인 여부에 따라 200/401, 일반 fetch엔 tag를 bodyText로 반환
function respondAs(ws: WebSocket, opts: { loggedIn?: boolean; fetchTag?: string; onFetch?: () => void }): void {
  ws.on('message', (raw) => {
    const cmd = JSON.parse(raw.toString());
    if (cmd.keepalive) return;
    if (cmd.fanout) {
      ws.send(
        JSON.stringify(
          opts.loggedIn
            ? { id: cmd.id, ok: true, status: 200, bodyText: '{"accounts":[{"accountId":1}]}' }
            : { id: cmd.id, ok: false, code: 'HTTP_ERROR', status: 401, error: 'HTTP 401', bodyText: '{"code":5}' }
        )
      );
    } else {
      opts.onFetch?.();
      ws.send(JSON.stringify({ id: cmd.id, ok: true, status: 200, bodyText: opts.fetchTag ?? 'fetch' }));
    }
  });
}

describe('Broker — 확장 라우팅', () => {
  it('확장 미연결이면 즉시 DISCONNECTED', async () => {
    broker = new Broker(TEST_PORT);
    const reply = await broker.request(probe());
    expect(reply.ok).toBe(false);
    if (!reply.ok) expect(reply.code).toBe('DISCONNECTED');
  });

  it('확장이 응답하면 그 응답을 돌려준다', async () => {
    broker = new Broker(TEST_PORT);
    const ws = await connectExtension();
    ws.on('message', (raw) => {
      const cmd = JSON.parse(raw.toString());
      ws.send(JSON.stringify({ id: cmd.id, ok: true, status: 200, bodyText: '{"hello":1}' }));
    });
    const reply = await broker.request(fetchCmd());
    expect(reply.ok).toBe(true);
    if (reply.ok) expect(reply.bodyText).toBe('{"hello":1}');
    ws.close();
  });

  it('응답이 없으면 TIMEOUT', async () => {
    broker = new Broker(TEST_PORT);
    const ws = await connectExtension(); // 메시지 무시
    const reply = await broker.request(probe(), 200);
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

  it('fanout fetch가 다중 확장 중 첫 성공(로그인된) 확장을 고른다 (마지막 연결 아님)', async () => {
    broker = new Broker(TEST_PORT);
    const loggedIn = await connectExtension();
    const loggedOut = await connectExtension();
    respondAs(loggedIn, { loggedIn: true });
    respondAs(loggedOut, {});
    const reply = await broker.request(probe());
    expect(reply.ok).toBe(true);
    if (reply.ok) expect(reply.bodyText).toContain('accounts');
    loggedIn.close();
    loggedOut.close();
  });

  it('fanout이 고른 확장으로만 이후 fetch를 보낸다', async () => {
    broker = new Broker(TEST_PORT);
    const loggedIn = await connectExtension();
    const loggedOut = await connectExtension();
    let loggedOutGotFetch = false;
    respondAs(loggedIn, { loggedIn: true, fetchTag: 'from-logged-in' });
    respondAs(loggedOut, { fetchTag: 'from-logged-out', onFetch: () => (loggedOutGotFetch = true) });
    await broker.request(probe());
    const reply = await broker.request(fetchCmd());
    expect(reply.ok && reply.bodyText).toBe('from-logged-in');
    expect(loggedOutGotFetch).toBe(false);
    loggedIn.close();
    loggedOut.close();
  });

  it('모든 확장이 미로그인이면 첫 응답(401)을 그대로 돌려준다', async () => {
    broker = new Broker(TEST_PORT);
    const a = await connectExtension();
    const b = await connectExtension();
    respondAs(a, {});
    respondAs(b, {});
    const reply = await broker.request(probe());
    expect(reply.ok).toBe(false);
    if (!reply.ok) {
      expect(reply.code).toBe('HTTP_ERROR');
      expect(reply.status).toBe(401);
    }
    a.close();
    b.close();
  });
});

// hello(프로토콜 버전 보고)를 보내고 브로커가 처리할 틈을 준다
async function sendHello(ws: WebSocket, protocolVersion: number): Promise<void> {
  ws.send(JSON.stringify({ type: 'hello', protocolVersion, extensionVersion: '0.0.0-test' }));
  await new Promise((r) => setTimeout(r, 30));
}

describe('Broker — 프로토콜 핸드셰이크', () => {
  it('일치하는 hello를 보낸 확장은 정상 라우팅된다', async () => {
    broker = new Broker(TEST_PORT);
    const ws = await connectExtension();
    respondAs(ws, { loggedIn: true, fetchTag: 'ok' });
    await sendHello(ws, PROTOCOL_VERSION);
    const reply = await broker.request(fetchCmd());
    expect(reply.ok && reply.bodyText).toBe('ok');
    ws.close();
  });

  it('구버전 확장이면 fetch가 PROTOCOL_MISMATCH + 확장 업데이트 안내', async () => {
    broker = new Broker(TEST_PORT);
    const ws = await connectExtension();
    respondAs(ws, { loggedIn: true });
    await sendHello(ws, PROTOCOL_VERSION - 1);
    const reply = await broker.request(fetchCmd());
    expect(reply.ok).toBe(false);
    if (!reply.ok) {
      expect(reply.code).toBe('PROTOCOL_MISMATCH');
      expect(reply.error).toContain('확장');
      expect(reply.error).toContain('업데이트');
    }
    ws.close();
  });

  it('확장이 더 최신이면 서버 업데이트를 안내한다', async () => {
    broker = new Broker(TEST_PORT);
    const ws = await connectExtension();
    await sendHello(ws, PROTOCOL_VERSION + 1);
    const reply = await broker.request(probe());
    expect(reply.ok).toBe(false);
    if (!reply.ok) {
      expect(reply.code).toBe('PROTOCOL_MISMATCH');
      expect(reply.error).toContain('서버');
    }
    ws.close();
  });

  it('fanout은 불일치 확장을 제외하고 호환 확장을 고른다', async () => {
    broker = new Broker(TEST_PORT);
    const oldExt = await connectExtension();
    const curExt = await connectExtension();
    let oldGotFetch = false;
    respondAs(oldExt, { loggedIn: true, fetchTag: 'from-old', onFetch: () => (oldGotFetch = true) }); // 응답해도 제외돼야 함
    respondAs(curExt, { loggedIn: true, fetchTag: 'from-cur' });
    await sendHello(oldExt, PROTOCOL_VERSION - 1);
    await sendHello(curExt, PROTOCOL_VERSION);
    const reply = await broker.request(probe());
    expect(reply.ok).toBe(true);
    const after = await broker.request(fetchCmd());
    expect(after.ok && after.bodyText).toBe('from-cur');
    expect(oldGotFetch).toBe(false);
    oldExt.close();
    curExt.close();
  });

  it('hello를 안 보낸 확장(도입 전 dev 빌드)은 차단하지 않는다', async () => {
    broker = new Broker(TEST_PORT);
    const ws = await connectExtension();
    respondAs(ws, { fetchTag: 'legacy-ok' });
    const reply = await broker.request(fetchCmd());
    expect(reply.ok && reply.bodyText).toBe('legacy-ok');
    ws.close();
  });
});

function connectClient(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`); // origin 없음
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

let clientReqSeq = 0;
// 클라이언트로 명령을 보내고 같은 id의 응답 1건을 받는다 (bridgeStatus는 건너뜀).
function clientRequest(ws: WebSocket, cmd: Record<string, unknown>): Promise<any> {
  const id = `c-${++clientReqSeq}`;
  return new Promise((resolve) => {
    const onMsg = (raw: WebSocket.RawData) => {
      const m = JSON.parse(raw.toString());
      if (m.type === 'bridgeStatus') return; // 상태 통지 무시
      if (m.id !== id) return;
      ws.off('message', onMsg);
      resolve(m);
    };
    ws.on('message', onMsg);
    ws.send(JSON.stringify({ ...cmd, id }));
  });
}

describe('Broker — 멀티 클라이언트', () => {
  it('두 클라이언트가 동시 요청해도 각자 자기 응답만 받는다', async () => {
    broker = new Broker(TEST_PORT);
    const ext = await connectExtension();
    // 확장은 명령의 url을 그대로 bodyText로 되돌려줌 → 응답 격리 확인
    ext.on('message', (raw) => {
      const cmd = JSON.parse(raw.toString());
      if (cmd.keepalive) return;
      ext.send(JSON.stringify({ id: cmd.id, ok: true, status: 200, bodyText: cmd.url }));
    });
    const c1 = await connectClient();
    const c2 = await connectClient();
    const [r1, r2] = await Promise.all([
      clientRequest(c1, { type: 'fetch', url: 'URL-1', method: 'GET', headers: {} }),
      clientRequest(c2, { type: 'fetch', url: 'URL-2', method: 'GET', headers: {} }),
    ]);
    expect(r1.bodyText).toBe('URL-1');
    expect(r2.bodyText).toBe('URL-2');
    ext.close(); c1.close(); c2.close();
  });

  it('확장 접속/해제 시 클라이언트에 bridgeStatus를 브로드캐스트한다', async () => {
    broker = new Broker(TEST_PORT);
    const statuses: boolean[] = [];
    // 실제 BridgeClient처럼 open 전에 message 리스너를 붙여 초기 상태를 놓치지 않는다.
    const c = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
    c.on('message', (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.type === 'bridgeStatus') statuses.push(m.extension);
    });
    await new Promise((r) => c.on('open', r));
    // 접속 즉시 초기 상태(false) 1건이 온다
    await new Promise((r) => setTimeout(r, 50));
    const ext = await connectExtension();
    await new Promise((r) => setTimeout(r, 50));
    ext.close();
    await new Promise((r) => setTimeout(r, 50));
    expect(statuses[0]).toBe(false);      // 초기
    expect(statuses).toContain(true);     // 확장 연결
    expect(statuses[statuses.length - 1]).toBe(false); // 확장 해제
    c.close();
  });

  it('응답 전에 끊긴 클라이언트가 있어도 크래시하지 않는다', async () => {
    broker = new Broker(TEST_PORT);
    const ext = await connectExtension();
    ext.on('message', (raw) => {
      const cmd = JSON.parse(raw.toString());
      if (cmd.keepalive) return;
      setTimeout(() => ext.send(JSON.stringify({ id: cmd.id, ok: true, status: 200, bodyText: 'late' })), 80);
    });
    const c = await connectClient();
    c.send(JSON.stringify({ id: 'x1', type: 'fetch', url: 'u', method: 'GET', headers: {} }));
    await new Promise((r) => setTimeout(r, 10));
    c.close(); // 응답 오기 전에 끊음
    await new Promise((r) => setTimeout(r, 120)); // 확장 응답이 도착해도 무사
    expect(broker.extConnected).toBe(true);
    ext.close();
  });
});
