import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { BridgeCommand, BridgeReply } from '@maple/shared';
import { createServer, type BridgeLike } from '../src/mcp.js';

const ID = { worldId: 5, accountId: 1, characterId: 2 };

const item = (id: string) => ({ _id: id, itemName: '아케인셰이드 가즈', price: '100', pricePerItem: '100', quantity: 1, starforce: 22, currentUpgradeCount: 9, wishlistCount: 0, endDate: 'd', toolTip: {} });

const okSearch = (searchKey: string, total = 1) => ({
  items: [item('a:1')],
  page: 1, limit: 20, total, totalPages: 1, hasNext: false, searchKey,
});

// n건짜리 한 페이지 응답
const pageResp = (searchKey: string, page: number, count: number, total: number, hasNext: boolean) => ({
  items: Array.from({ length: count }, (_, i) => item(`p${page}:${i}`)),
  page, limit: 20, total, totalPages: Math.ceil(total / 20), hasNext, searchKey,
});

function fakeBridge(handler: (cmd: Omit<BridgeCommand, 'id'>) => BridgeReply): BridgeLike {
  return {
    connected: true,
    request: async (cmd) => handler(cmd),
  };
}

async function client(bridge: BridgeLike) {
  const server = createServer(bridge);
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st);
  const c = new Client({ name: 't', version: '0' });
  await c.connect(ct);
  return c;
}

function textOf(result: any): string {
  return result.content[0].text;
}

describe('search_items (POST 세션 생성)', () => {
  it('POST 결과(가격낮은순 10개 + searchKey + 남은 검색횟수)를 반환한다', async () => {
    const calls: any[] = [];
    const c = await client(fakeBridge((cmd) => {
      calls.push(cmd);
      if (cmd.type === 'discover') return { id: '1', ok: true, data: ID };
      if (cmd.method === 'GET') return { id: '3', ok: true, status: 200, data: { search: { limit: 100, remaining: 97 }, register: { limit: 20, remaining: 20 } } };
      return { id: '2', ok: true, status: 201, data: pageResp('key-1', 1, 10, 146, true) };
    }));
    const r = await c.callTool({ name: 'search_items', arguments: { keyword: '아케인셰이드 가즈' } });
    const parsed = JSON.parse(textOf(r));
    expect(parsed.total).toBe(146);
    expect(parsed.searchKey).toBe('key-1');
    expect(parsed.items).toHaveLength(10);
    expect(parsed.searchRemaining).toBe(97); // 남은 생성 횟수
    // POST(세션 생성) + GET(남은 횟수 조회, 무료)
    const fetches = calls.filter((c) => c.type === 'fetch');
    expect(fetches.find((f) => f.method === 'POST').body.limit).toBe(10);
    expect(fetches.find((f) => f.method === 'POST').body.sortType).toBe('PRICE_PER_ITEM_ASC');
    expect(fetches.find((f) => f.method === 'POST').body.accountId).toBe(1);
    expect(fetches.some((f) => f.method === 'GET' && /daily-limit/.test(f.url))).toBe(true);
  });

  it('403이면 로그인 안내를 반환한다', async () => {
    const c = await client(fakeBridge((cmd) => {
      if (cmd.type === 'discover') return { id: '1', ok: true, data: ID };
      return { id: '2', ok: false, code: 'HTTP_ERROR', status: 403, error: 'HTTP 403' };
    }));
    const r = await c.callTool({ name: 'search_items', arguments: { keyword: 'x' } });
    expect(textOf(r)).toContain('로그인');
  });
});

describe('get_page (GET 정렬/페이지네이션)', () => {
  it('지정 정렬·페이지·크기로 GET하고 검색 횟수를 소진하지 않는다', async () => {
    const calls: any[] = [];
    const c = await client(fakeBridge((cmd) => {
      calls.push(cmd);
      if (cmd.type === 'discover') return { id: '1', ok: true, data: ID };
      return { id: '2', ok: true, status: 200, data: pageResp('k', 2, 40, 146, true) };
    }));
    const r = await c.callTool({ name: 'get_page', arguments: { searchKey: 'k', page: 2, limit: 40, sort: 'ATTACK_POWER_DESC' } });
    const parsed = JSON.parse(textOf(r));
    expect(parsed.page).toBe(2);
    expect(parsed.hasNext).toBe(true);
    const fetches = calls.filter((c) => c.type === 'fetch');
    expect(fetches).toHaveLength(1);
    expect(fetches[0].method).toBe('GET'); // POST 없음 → 검색 횟수 무료
    const u = new URL(fetches[0].url);
    expect(u.searchParams.get('page')).toBe('2');
    expect(u.searchParams.get('limit')).toBe('40');
    expect(u.searchParams.get('sortType')).toBe('ATTACK_POWER_DESC');
  });

  it('limit이 20/40/60이 아니면 MCP단에서 막는다', async () => {
    const calls: any[] = [];
    const c = await client(fakeBridge((cmd) => (calls.push(cmd), cmd.type === 'discover' ? { id: '1', ok: true, data: ID } : { id: '2', ok: true, status: 200, data: pageResp('k', 1, 20, 20, false) })));
    const r: any = await c.callTool({ name: 'get_page', arguments: { searchKey: 'k', page: 1, limit: 30 } });
    expect(r.isError).toBe(true);
    // 차단됐으니 API 호출 자체가 없어야 한다
    expect(calls.filter((c) => c.type === 'fetch')).toHaveLength(0);
  });

  it('없는 정렬값이면 MCP단에서 막는다', async () => {
    const calls: any[] = [];
    const c = await client(fakeBridge((cmd) => (calls.push(cmd), cmd.type === 'discover' ? { id: '1', ok: true, data: ID } : { id: '2', ok: true, status: 200, data: pageResp('k', 1, 20, 20, false) })));
    const r: any = await c.callTool({ name: 'get_page', arguments: { searchKey: 'k', sort: 'NOPE_DESC' } });
    expect(r.isError).toBe(true);
    expect(calls.filter((c) => c.type === 'fetch')).toHaveLength(0);
  });

  it('GET 4xx(키 만료)면 캐시된 조건으로 재검색 후 해당 페이지를 반환한다', async () => {
    const calls: any[] = [];
    let postCount = 0;
    const c = await client(fakeBridge((cmd) => {
      calls.push(cmd);
      if (cmd.type === 'discover') return { id: '1', ok: true, data: ID };
      if (cmd.method === 'POST') {
        postCount += 1;
        // 1st POST(search_items) → key-A, 2nd POST(재검색) → key-B
        return { id: '2', ok: true, status: 201, data: pageResp(postCount === 1 ? 'key-A' : 'key-B', 1, 10, 146, true) };
      }
      // GET: 만료된 key-A는 실패, 재검색된 key-B는 성공
      const key = new URL(cmd.url).pathname.split('/searches/')[1].split('/')[0];
      if (key === 'key-A') return { id: '3', ok: false, code: 'HTTP_ERROR', status: 404, error: 'HTTP 404' };
      return { id: '4', ok: true, status: 200, data: pageResp('key-B', 3, 20, 146, true) };
    }));
    await c.callTool({ name: 'search_items', arguments: { keyword: 'x' } }); // key-A 캐시 생성
    const r = await c.callTool({ name: 'get_page', arguments: { searchKey: 'key-A', page: 3, limit: 20 } });
    const parsed = JSON.parse(textOf(r));
    expect(parsed.page).toBe(3);
    expect(parsed.searchKey).toBe('key-B');
    expect(postCount).toBe(2); // 최초 검색 + 만료 복구 재검색
  });
});

describe('get_status', () => {
  it('연결·identity 상태를 반환한다', async () => {
    const c = await client(fakeBridge((cmd) =>
      cmd.type === 'discover' ? { id: '1', ok: true, data: ID } : { id: '2', ok: true }
    ));
    const r = await c.callTool({ name: 'get_status', arguments: {} });
    expect(textOf(r)).toContain('"connected": true');
    expect(textOf(r)).toContain('"accountId": 1');
  });

  it('확장 미연결이면 안내를 반환한다', async () => {
    const c = await client({ connected: false, request: async () => ({ id: '', ok: false, code: 'DISCONNECTED', error: '미연결' }) });
    const r = await c.callTool({ name: 'get_status', arguments: {} });
    expect(textOf(r)).toContain('확장');
  });
});
