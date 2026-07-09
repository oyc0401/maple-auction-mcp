import { describe, it, expect } from 'vitest';
import { executeFetch, discoverIdentity } from '../src/api.js';
import type { FetchCommand } from '@maple/shared';

const cmd = (over: Partial<FetchCommand> = {}): FetchCommand => ({
  id: 'i1',
  type: 'fetch',
  url: 'https://api.mskr.nexon.com/x',
  method: 'GET',
  ...over,
});

function fakeFetch(status: number, json: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
}

describe('executeFetch', () => {
  it('2xx면 ok:true + data', async () => {
    const r = await executeFetch(cmd(), fakeFetch(200, { total: 1 }));
    expect(r).toEqual({ id: 'i1', ok: true, status: 200, data: { total: 1 } });
  });

  it('POST면 JSON body + Content-Type을 붙인다', async () => {
    let seen: RequestInit | undefined;
    const spy: typeof fetch = (async (_u: any, init?: RequestInit) => {
      seen = init;
      return new Response('{}', { status: 201 });
    }) as typeof fetch;
    await executeFetch(cmd({ method: 'POST', body: { a: 1 } }), spy);
    expect(seen?.credentials).toBe('include');
    expect(seen?.body).toBe('{"a":1}');
    expect((seen?.headers as any)['Content-Type']).toBe('application/json');
  });

  it('api.mskr 게이트 통과용 헤더(x-platform/x-device-id/accept)를 항상 붙인다', async () => {
    let seen: RequestInit | undefined;
    const spy: typeof fetch = (async (_u: any, init?: RequestInit) => {
      seen = init;
      return new Response('{}', { status: 200 });
    }) as typeof fetch;
    await executeFetch(cmd(), spy);
    const h = seen?.headers as Record<string, string>;
    expect(h['x-platform']).toBe('PC_WEB');
    expect(h['x-device-id']).toMatch(/^[0-9a-f]{32}$/);
    expect(h['x-client-version']).toBe('1.0.1');
    expect(h['accept']).toContain('application/json');
  });

  it('4xx면 HTTP_ERROR + status + 에러 body', async () => {
    const r = await executeFetch(cmd(), fakeFetch(403, { code: 4 }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('HTTP_ERROR');
      expect(r.status).toBe(403);
      expect(r.data).toEqual({ code: 4 });
    }
  });

  it('fetch가 throw하면 NETWORK', async () => {
    const boom: typeof fetch = (async () => {
      throw new Error('net down');
    }) as typeof fetch;
    const r = await executeFetch(cmd(), boom);
    expect(!r.ok && r.code).toBe('NETWORK');
  });
});

// URL 패턴별로 응답을 라우팅하는 fake fetch. calls 배열에 호출된 URL을 기록한다.
function routedFetch(
  routes: Array<[RegExp, { status: number; json: unknown }]>,
  calls: string[] = []
): typeof fetch {
  return (async (u: any) => {
    const url = String(u);
    calls.push(url);
    for (const [re, v] of routes) {
      if (re.test(url)) return new Response(JSON.stringify(v.json), { status: v.status });
    }
    return new Response('{"code":2}', { status: 500 });
  }) as typeof fetch;
}

describe('discoverIdentity', () => {
  it('세션→계정→월드 스캔 후 최고 레벨 캐릭터를 선택한다', async () => {
    const r = await discoverIdentity(
      routedFetch([
        [/auth\/web-token\/session/, { status: 201, json: {} }],
        [/accounts$/, { status: 200, json: { accounts: [{ accountId: 99188397 }] } }],
        [/gameWorlds\/5\/characters/, { status: 200, json: { characters: [{ characterId: 25631906, characterName: '오유찬', level: 270 }] } }],
        [/gameWorlds\/45\/characters/, { status: 200, json: { characters: [{ characterId: 6440020, characterName: '피구르', level: 202 }] } }],
      ])
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual({ worldId: 5, accountId: 99188397, characterId: 25631906, characterName: '오유찬' });
  });

  it('계정 조회가 401이면 로그인 안내(NO_IDENTITY)', async () => {
    const r = await discoverIdentity(
      routedFetch([
        [/auth\/web-token\/session/, { status: 201, json: {} }],
        [/accounts$/, { status: 401, json: {} }],
      ])
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('NO_IDENTITY');
      expect(r.error).toContain('nxlogin.nexon.com');
    }
  });

  // 회귀 방지: 정상 로그인(GET /accounts 200) 시 세션을 회전시키는 web-token/session POST를
  // 절대 쏘지 않아야 한다. (그 POST가 확장 컨텍스트에서 로그아웃을 유발했음)
  it('계정 조회가 200이면 web-token/session POST를 쏘지 않는다', async () => {
    const calls: string[] = [];
    const r = await discoverIdentity(
      routedFetch(
        [
          [/auth\/web-token\/session/, { status: 201, json: {} }],
          [/accounts$/, { status: 200, json: { accounts: [{ accountId: 1 }] } }],
          [/gameWorlds\/5\/characters/, { status: 200, json: { characters: [{ characterId: 9, characterName: 'ㄱ', level: 1 }] } }],
        ],
        calls
      )
    );
    expect(r.ok).toBe(true);
    expect(calls.some((u) => /auth\/web-token\/session/.test(u))).toBe(false);
  });

  it('계정 조회가 401이면 최후수단으로 web-token/session POST를 쏜다', async () => {
    const calls: string[] = [];
    await discoverIdentity(
      routedFetch([[/accounts$/, { status: 401, json: {} }]], calls)
    );
    expect(calls.some((u) => /auth\/web-token\/session/.test(u))).toBe(true);
  });

  it('캐릭터가 하나도 없으면 NO_IDENTITY', async () => {
    const r = await discoverIdentity(
      routedFetch([
        [/auth\/web-token\/session/, { status: 201, json: {} }],
        [/accounts$/, { status: 200, json: { accounts: [{ accountId: 1 }] } }],
      ])
    );
    expect(!r.ok && r.code).toBe('NO_IDENTITY');
  });
});
