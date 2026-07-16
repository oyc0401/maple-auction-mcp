import { describe, it, expect, afterEach } from 'vitest';
import WebSocket from 'ws';
import { Bridge } from './bridge.js';
import { Broker } from './broker.js';

// 멀티 세션 통합: 브로커 1개에 확장 1개 + MCP 클라이언트(Bridge) 2개가 붙어
// 동시에 요청해도 각 세션이 자기 응답만 받고 둘 다 connected 되는지 검증한다.
const TEST_PORT = 29974;
let broker: Broker;
let a: Bridge;
let b: Bridge;

afterEach(async () => {
  await a?.close();
  await b?.close();
  await broker?.close();
});

// 로그인된 확장처럼 동작: fanout 프로브엔 200, 일반 fetch엔 요청 url을 그대로 되돌려줌.
function connectLoggedInExtension(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`, { origin: 'chrome-extension://x' });
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
    ws.on('message', (raw) => {
      const cmd = JSON.parse(raw.toString());
      if (cmd.keepalive) return;
      if (cmd.fanout) {
        ws.send(JSON.stringify({ id: cmd.id, ok: true, status: 200, bodyText: '{"accounts":[{"accountId":1}]}' }));
      } else {
        ws.send(JSON.stringify({ id: cmd.id, ok: true, status: 200, bodyText: cmd.url }));
      }
    });
  });
}

const settle = () => new Promise((r) => setTimeout(r, 150));

describe('멀티 세션 통합', () => {
  it('두 세션이 한 브로커·한 확장을 공유하며 동시 요청이 격리된다', async () => {
    broker = new Broker(TEST_PORT);
    const ext = await connectLoggedInExtension();

    a = new Bridge(TEST_PORT);
    b = new Bridge(TEST_PORT);
    await settle();

    // 두 세션 모두 확장 연결을 인지
    expect(a.connected).toBe(true);
    expect(b.connected).toBe(true);

    // 각 세션이 fanout 프로브로 로그인 확인을 받는다 (브로커가 preferred 고정)
    const probe = { type: 'fetch', url: 'https://a.nexon.com/accounts', method: 'GET', headers: {}, fanout: true } as const;
    const [da, db] = await Promise.all([a.request(probe), b.request(probe)]);
    expect(da.ok && da.bodyText).toContain('accounts');
    expect(db.ok && db.bodyText).toContain('accounts');

    // 동시 fetch — 각자 자기 url만 되돌려받아야 함 (응답 격리)
    const [ra, rb] = await Promise.all([
      a.request({ type: 'fetch', url: 'SESSION-A', method: 'GET', headers: {} }),
      b.request({ type: 'fetch', url: 'SESSION-B', method: 'GET', headers: {} }),
    ]);
    expect(ra.ok && ra.bodyText).toBe('SESSION-A');
    expect(rb.ok && rb.bodyText).toBe('SESSION-B');

    ext.close();
  });

  it('한 세션이 닫혀도 다른 세션과 확장 연결은 유지된다', async () => {
    broker = new Broker(TEST_PORT);
    const ext = await connectLoggedInExtension();
    a = new Bridge(TEST_PORT);
    b = new Bridge(TEST_PORT);
    await settle();

    await a.close(); // A 세션 종료

    // B는 여전히 동작
    expect(b.connected).toBe(true);
    const rb = await b.request({ type: 'fetch', url: 'STILL-ALIVE', method: 'GET', headers: {} });
    expect(rb.ok && rb.bodyText).toBe('STILL-ALIVE');
    // 확장도 브로커에 그대로 붙어있음
    expect(broker.extConnected).toBe(true);

    ext.close();
  });
});
