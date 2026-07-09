import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { BridgeCommandInput, BridgeReply } from '@maple/shared';
import { createServer, type BridgeLike } from '../src/mcp.js';
import { fetchScouter, clearScouterCache } from '../src/hwansan2/scouterClient.js';

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

function fakeBridge(handler: (cmd: BridgeCommandInput) => BridgeReply): BridgeLike {
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

describe('item_hwansan (단일 매물 교체 환산)', () => {
  // 검색이 rawItemCache를 채우도록 discover→POST(201)→GET(daily-limit)를 처리하는 브리지.
  const searchBridge = () => fakeBridge((cmd) => {
    if (cmd.type === 'discover') return { id: '1', ok: true, data: ID };
    if (cmd.method === 'GET') return { id: '3', ok: true, status: 200, data: { search: { limit: 100, remaining: 90 }, register: { limit: 20, remaining: 20 } } };
    return { id: '2', ok: true, status: 201, data: okSearch('k') }; // items: [item('a:1')]
  });

  it('검색으로 캐시된 적 없는 매물 id면 먼저 검색하라고 안내한다', async () => {
    const c = await client(searchBridge());
    const r = await c.callTool({ name: 'item_hwansan', arguments: { itemId: 'unknown:9' } });
    expect(textOf(r)).toContain('원본을 찾을 수 없습니다');
  });

  it('무기 매물도 카테고리 가드를 통과해 캐릭터 기준을 요구한다(무기 환산 지원)', async () => {
    const c = await client(searchBridge());
    await c.callTool({ name: 'search_weapon', arguments: { subCategory: 'WEAPON' } }); // a:1 캐시(category WEAPON)
    const r = await c.callTool({ name: 'item_hwansan', arguments: { itemId: 'a:1' } });
    expect(textOf(r)).not.toContain('지원하지 않습니다');
    expect(textOf(r)).toContain('캐릭터 이름'); // 무기 게이트 제거 → 방어구와 동일 경로
  });

  it('방어구 매물이면 카테고리 가드를 통과해 캐릭터 기준을 요구한다(네트워크 없음)', async () => {
    const c = await client(searchBridge());
    await c.callTool({ name: 'search_armor', arguments: { subCategory: 'ARMOR_ACCESSORY_RING' } }); // a:1 캐시(반지)
    const r = await c.callTool({ name: 'item_hwansan', arguments: { itemId: 'a:1' } });
    expect(textOf(r)).toContain('캐릭터 이름');
  });

  it('착용 부위가 아닌 slot을 주면 가능한 부위를 안내한다(신원 불필요)', async () => {
    const c = await client(searchBridge());
    await c.callTool({ name: 'search_armor', arguments: { subCategory: 'ARMOR_ACCESSORY_RING' } });
    const r = await c.callTool({ name: 'item_hwansan', arguments: { itemId: 'a:1', slot: '모자' } });
    expect(textOf(r)).toContain('가능한 부위');
  });
});

describe('user_equip (캐릭터 착용 장비 조회)', () => {
  const idResponse = JSON.parse(readFileSync(new URL('../src/scouter/id-response', import.meta.url), 'utf8'));
  // 스카우터 캐시를 fixture로 시딩 → 도구 핸들러의 fetchScouter(name)가 네트워크 없이 캐시 히트
  async function seedScouter(name: string) {
    clearScouterCache();
    const f = vi.fn(async () => ({ ok: true, status: 200, json: async () => idResponse } as Response));
    await fetchScouter(name, { fetchFn: f as any });
  }
  const noopBridge = () => fakeBridge(() => ({ id: '1', ok: true, data: ID }));

  it('slot 생략 시 24부위 요약 + 환산380을 반환한다', async () => {
    await seedScouter('오유찬');
    const c = await client(noopBridge());
    const r = await c.callTool({ name: 'user_equip', arguments: { characterName: '오유찬' } });
    const parsed = JSON.parse(textOf(r));
    expect(parsed.character).toBe('오유찬');
    expect(parsed.hwansan380).toBe(30371);
    expect(parsed.items).toHaveLength(24);
    const weapon = parsed.items.find((i: any) => i.slot === '무기');
    expect(weapon).toMatchObject({ name: '아케인셰이드 체인', star: 17, pot: '레전드리', add: '유니크' });
  });

  it('slot 지정 시 스탯·잠재·에디·소울 상세를 반환한다', async () => {
    await seedScouter('오유찬');
    const c = await client(noopBridge());
    const r = await c.callTool({ name: 'user_equip', arguments: { characterName: '오유찬', slot: '무기' } });
    const parsed = JSON.parse(textOf(r));
    expect(parsed.name).toBe('아케인셰이드 체인');
    expect(parsed.starforce).toBe(17);
    expect(parsed.stat).toContain('공격력+649');
    expect(parsed.potential).toContain('레전드리:');
    expect(parsed.potential).toContain('몬스터 방어율 무시 +40%');
    expect(parsed.additional).toContain('공격력 +9%');
    expect(parsed.soul).toContain('보스 몬스터 데미지 +7%');
    expect(parsed.cuttable).toBe(3);
  });

  it('없는 slot이면 가능한 부위를 안내한다', async () => {
    await seedScouter('오유찬');
    const c = await client(noopBridge());
    const r = await c.callTool({ name: 'user_equip', arguments: { characterName: '오유찬', slot: '날개' } });
    expect(textOf(r)).toContain('가능한 부위');
    expect(textOf(r)).toContain('무기');
  });

  it('characterName 생략 + 신원에 이름이 없으면 지정을 안내한다', async () => {
    const c = await client(noopBridge()); // discover가 characterName 없이 응답
    const r = await c.callTool({ name: 'user_equip', arguments: {} });
    expect(textOf(r)).toContain('characterName');
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

describe('search_weapon / search_armor (상세 필터 검색)', () => {
  it('subCategory 기본값(WEAPON)과 상세 필터로 POST 바디를 만든다', async () => {
    const calls: any[] = [];
    const c = await client(fakeBridge((cmd) => {
      calls.push(cmd);
      if (cmd.type === 'discover') return { id: '1', ok: true, data: ID };
      if (cmd.method === 'GET') return { id: '3', ok: true, status: 200, data: { search: { limit: 100, remaining: 97 } } };
      return { id: '2', ok: true, status: 201, data: pageResp('key-w', 1, 10, 5, false) };
    }));
    const r = await c.callTool({
      name: 'search_weapon',
      arguments: {
        subCategory: 'WEAPON_ONE_HANDED_CHAIN',
        additionalPotentialOptions: [{ option: 'physicalAttackPercent', minValue: 21 }],
        myWorldOnly: true,
      },
    });
    const parsed = JSON.parse(textOf(r));
    expect(parsed.searchKey).toBe('key-w');
    const post = calls.find((c) => c.type === 'fetch' && c.method === 'POST');
    expect(post.body.filters.itemCategory).toEqual({ itemDetailCategory: 'WEAPON_ONE_HANDED_CHAIN' });
    expect(post.body.filters.enhancementOption.additionalPotentialOptionSum).toEqual({ physicalAttackPercent: 21 });
    expect(post.body.filters.myWorldOnly).toBe(true);
  });

  it('잘못된 옵션 키는 MCP단에서 막는다', async () => {
    const calls: any[] = [];
    const c = await client(fakeBridge((cmd) => (calls.push(cmd), { id: '1', ok: true, data: ID })));
    const r: any = await c.callTool({
      name: 'search_weapon',
      arguments: { potentialOptions: [{ option: 'notAnOption', minValue: 1 }] },
    });
    expect(r.isError).toBe(true);
    expect(calls.filter((c) => c.type === 'fetch')).toHaveLength(0);
  });
});

// 인증 API를 흉내내는 브리지: accounts / gameWorlds/{5,45}에 캐릭터가 있다
function authBridge(extra?: (cmd: any) => BridgeReply | null): BridgeLike {
  return fakeBridge((cmd: any) => {
    const hit = extra?.(cmd);
    if (hit) return hit;
    if (cmd.type === 'discover') return { id: '1', ok: true, data: ID };
    if (/\/accounts$/.test(cmd.url)) return { id: '2', ok: true, data: { accounts: [{ accountId: 1 }] } };
    const m = cmd.url?.match(/gameWorlds\/(\d+)\/characters/);
    if (m) {
      const w = Number(m[1]);
      if (w === 5) return { id: '3', ok: true, data: { characters: [{ characterId: 2, characterName: '오유찬', level: 270 }] } };
      if (w === 45) return { id: '4', ok: true, data: { characters: [{ characterId: 9, characterName: '에오스캐릭', level: 200 }] } };
      return { id: '5', ok: false, code: 'HTTP_ERROR', status: 500, error: 'HTTP 500' };
    }
    return { id: '9', ok: true };
  });
}

describe('list_characters / set_character', () => {
  it('월드 이름을 붙여 캐릭터 목록을 반환한다', async () => {
    const c = await client(authBridge());
    const r = await c.callTool({ name: 'list_characters', arguments: {} });
    const parsed = JSON.parse(textOf(r));
    expect(parsed).toEqual([
      { world: '크로아', name: '오유찬', level: 270, characterId: 2 },
      { world: '에오스', name: '에오스캐릭', level: 200, characterId: 9 },
    ]);
  });

  it('set_character로 다른 월드 캐릭터로 전환하면 이후 검색이 그 월드로 나간다', async () => {
    const posts: any[] = [];
    const c = await client(authBridge((cmd: any) => {
      if (cmd.type === 'fetch' && cmd.method === 'POST' && /tool-tip/.test(cmd.url)) {
        posts.push(cmd.body);
        return { id: '6', ok: true, status: 201, data: pageResp('k', 1, 10, 1, false) };
      }
      if (cmd.type === 'fetch' && /daily-limit/.test(cmd.url)) return { id: '7', ok: true, data: { search: { remaining: 1 } } };
      return null;
    }));
    const r = await c.callTool({ name: 'set_character', arguments: { characterName: '에오스캐릭' } });
    expect(JSON.parse(textOf(r)).switched.world).toBe('에오스');
    await c.callTool({ name: 'search_items', arguments: { keyword: 'x' } });
    expect(posts[0].worldId).toBe(45);
    expect(posts[0].characterId).toBe(9);
  });

  it('없는 이름이면 안내를 반환한다', async () => {
    const c = await client(authBridge());
    const r = await c.callTool({ name: 'set_character', arguments: { characterName: '없는캐릭' } });
    expect(textOf(r)).toContain('일치하는 캐릭터가 없습니다');
  });
});

describe('recent_sold (최근 시세, 검색 횟수 무료)', () => {
  it('identity만 담아 POST하고 결과를 요약한다', async () => {
    const calls: any[] = [];
    const c = await client(fakeBridge((cmd: any) => {
      calls.push(cmd);
      if (cmd.type === 'discover') return { id: '1', ok: true, data: ID };
      return { id: '2', ok: true, status: 201, data: pageResp('sold', 1, 10, 10, false) };
    }));
    const r = await c.callTool({ name: 'recent_sold', arguments: {} });
    const parsed = JSON.parse(textOf(r));
    expect(parsed.items).toHaveLength(10);
    const post = calls.find((c) => c.type === 'fetch');
    expect(post.url).toContain('/searches/sold/recent');
    expect(post.body).toEqual({ worldId: 5, accountId: 1, characterId: 2 });
    // daily-limit 조회도 하지 않는다 (무료 API)
    expect(calls.filter((c) => c.type === 'fetch')).toHaveLength(1);
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

describe('maple://knowledge 리소스', () => {
  it('지식 노트 전문을 서빙한다', async () => {
    const c = await client(fakeBridge(() => ({ id: '1', ok: true })));
    const list = await c.listResources();
    expect(list.resources.map((r) => r.uri)).toContain('maple://knowledge');
    const res = await c.readResource({ uri: 'maple://knowledge' });
    const text = (res.contents[0] as { text?: string }).text ?? '';
    expect(text).toContain('메이플 지식 노트');
    expect(text).toContain('가위횟수');
  });
});

describe('get_knowledge (지식 노트 도구)', () => {
  it('지식 노트 전문을 반환한다', async () => {
    const c = await client(fakeBridge(() => ({ id: '1', ok: true })));
    const r = await c.callTool({ name: 'get_knowledge', arguments: {} });
    expect(textOf(r)).toContain('메이플 지식 노트');
    expect(textOf(r)).toContain('가위횟수');
  });
});
