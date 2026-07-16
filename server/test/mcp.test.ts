import { describe, it, expect, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { MapleAuctionApi, type AuctionCommandInput, type AuctionReply, type AuctionTransport } from '../src/auction/api.js';
import { createServer } from '../src/mcp.js';
import {
  loadCharacterSnapshot,
  type CharacterSnapshot,
  type LoadCharacterSnapshot,
  type RefreshCharacterSnapshot,
} from '../src/characterSnapshot.js';
import type { ItemEquipmentRes } from '../src/nexon/types.js';

const ID = { worldId: 5, accountId: 1, characterId: 2 };

const item = (id: string) => ({ _id: id, itemName: '아케인셰이드 가즈', price: '100', pricePerItem: '100', quantity: 1, starforce: 22, currentUpgradeCount: 9, wishlistCount: 0, endDate: 'd', toolTip: {} });

// n건짜리 한 페이지 응답
const pageResp = (searchKey: string, page: number, count: number, total: number, hasNext: boolean) => ({
  items: Array.from({ length: count }, (_, i) => item(`p${page}:${i}`)),
  page, limit: 20, total, totalPages: Math.ceil(total / 20), hasNext, searchKey,
});

function fakeBridge(handler: (cmd: AuctionCommandInput) => AuctionReply): AuctionTransport {
  return {
    connected: true,
    request: async (cmd) => handler(cmd),
  };
}

// 구 discover 픽스처 대체: 발견 체인(GET /accounts → gameWorlds/{w}/characters)에 응답.
// ID(월드 5, 캐릭터 2)와 일치하는 신원을 준다. 핸들러의 calls.push보다 먼저 처리해
// 신원 조회가 기존 fetch 호출 수 단언에 잡히지 않게 한다.
// characterName은 일부러 뺀다 — 이름 미상 경로(기준 캐릭터 지정 안내)를
// 네트워크 없이 검증하는 테스트에서 사용한다.
function identityFetch(cmd: AuctionCommandInput): AuctionReply | null {
  if (/\/accounts$/.test(cmd.url)) return { id: 'i', ok: true, status: 200, data: { accounts: [{ accountId: 1 }] } };
  const m = cmd.url.match(/gameWorlds\/(\d+)\/characters$/);
  if (!m) return null;
  return m[1] === '5'
    ? { id: 'i', ok: true, status: 200, data: { characters: [{ characterId: 2, level: 280 }] } }
    : { id: 'i', ok: false, code: 'HTTP_ERROR', status: 500, error: 'HTTP 500', data: { code: 2 } }; // 캐릭터 없는 월드 (실측 500)
}

async function client(
  bridge: AuctionTransport,
  loadSnapshot: LoadCharacterSnapshot = loadCharacterSnapshot,
  refreshSnapshot: RefreshCharacterSnapshot = loadSnapshot
) {
  const server = createServer(new MapleAuctionApi(bridge), loadSnapshot, refreshSnapshot);
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
      const idr = identityFetch(cmd);
      if (idr) return idr;
      calls.push(cmd);
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
      const idr = identityFetch(cmd);
      if (idr) return idr;
      return { id: '2', ok: false, code: 'HTTP_ERROR', status: 403, error: 'HTTP 403' };
    }));
    const r = await c.callTool({ name: 'search_items', arguments: { keyword: 'x' } });
    expect(textOf(r)).toContain('로그인');
  });
});

describe('MCP 도구 표면', () => {
  it('별도 item_damage 도구를 노출하지 않는다', async () => {
    const c = await client(
      fakeBridge((cmd) =>
        identityFetch(cmd) ?? {
          id: '1',
          ok: true,
          status: 200,
          data: {},
        }
      )
    );

    const tools = await c.listTools();

    expect(tools.tools.map((tool) => tool.name)).not.toContain('item_damage');
    expect(tools.tools.map((tool) => tool.name)).toContain('refresh_character');
  });

  it('refresh_character는 지정한 캐릭터를 강제로 재갱신한다', async () => {
    const refreshSnapshot = vi.fn(async (name: string) => ({
      name,
      job: '카데나',
      level: 290,
      stats: { 기본: {}, AP: {} },
      equipment: { item_equipment: [] } as unknown as ItemEquipmentRes,
    }));
    const c = await client(
      fakeBridge(() => ({ id: '1', ok: true, data: ID })),
      refreshSnapshot,
      refreshSnapshot
    );

    const result = await c.callTool({
      name: 'refresh_character',
      arguments: { characterName: '재갱신캐릭터' },
    });

    expect(refreshSnapshot).toHaveBeenCalledWith('재갱신캐릭터');
    expect(JSON.parse(textOf(result))).toMatchObject({
      refreshed: true,
      character: '재갱신캐릭터',
      class: '카데나',
      level: 290,
    });
  });
});

describe('user_equip (캐릭터 착용 장비 조회, 넥슨 오픈 API)', () => {
  const noopBridge = () => fakeBridge(() => ({ id: '1', ok: true, data: ID }));

  const weaponItem = {
    item_equipment_slot: '무기', item_name: '아케인셰이드 체인', starforce: '17', scroll_upgrade: '8',
    potential_option_grade: '레전드리', additional_potential_option_grade: '유니크',
    item_total_option: { attack_power: '649', luk: '100', boss_damage: '30' },
    potential_option_1: '몬스터 방어율 무시 +40%', potential_option_2: '보스 몬스터 데미지 +35%', potential_option_3: null,
    additional_potential_option_1: '공격력 +9%', additional_potential_option_2: null, additional_potential_option_3: null,
    soul_name: '위대한 매그너스의 소울 적용', soul_option: '보스 몬스터 데미지 +7%', cuttable_count: '3',
  };
  const characterSnapshot: CharacterSnapshot = {
    name: '오유찬',
    job: '카데나',
    level: 270,
    stats: { 기본: {}, AP: {} },
    equipment: { item_equipment: [weaponItem] } as unknown as ItemEquipmentRes,
  };

  it('넥슨 키가 없으면 발급·설정 안내를 반환한다', async () => {
    const c = await client(noopBridge(), async () => {
      throw new Error('NEXON_DEVELOPER_KEY 미설정');
    });
    const r = await c.callTool({ name: 'user_equip', arguments: { characterName: '오유찬' } });
    expect(textOf(r)).toContain('--api-key');
    expect(textOf(r)).toContain('openapi.nexon.com');
  });

  it('slot 생략 시 부위 요약 목록을 반환한다', async () => {
    const c = await client(noopBridge(), async () => characterSnapshot);
    const r = await c.callTool({ name: 'user_equip', arguments: { characterName: '오유찬' } });
    const parsed = JSON.parse(textOf(r));
    expect(parsed.character).toBe('오유찬');
    expect(parsed.class).toBe('카데나');
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]).toMatchObject({ slot: '무기', name: '아케인셰이드 체인', star: 17, pot: '레전드리', add: '유니크' });
  });

  it('slot 지정 시 스탯·잠재·에디·소울 상세를 반환한다', async () => {
    const c = await client(noopBridge(), async () => characterSnapshot);
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
    const c = await client(noopBridge(), async () => characterSnapshot);
    const r = await c.callTool({ name: 'user_equip', arguments: { characterName: '오유찬', slot: '날개' } });
    expect(textOf(r)).toContain('가능한 부위');
    expect(textOf(r)).toContain('무기');
  });

  it('characterName 생략 + 신원에 이름이 없으면(env 신원) 지정을 안내한다', async () => {
    process.env.MAPLE_IDENTITY = JSON.stringify(ID); // env 폴백 신원에는 characterName이 없다
    try {
      const c = await client(noopBridge()); // 발견 체인 실패 → env 폴백
      const r = await c.callTool({ name: 'user_equip', arguments: {} });
      expect(textOf(r)).toContain('characterName');
    } finally {
      delete process.env.MAPLE_IDENTITY;
    }
  });
});

describe('get_page (GET 정렬/페이지네이션)', () => {
  it('지정 정렬·페이지·크기로 GET하고 검색 횟수를 소진하지 않는다', async () => {
    const calls: any[] = [];
    const c = await client(fakeBridge((cmd) => {
      const idr = identityFetch(cmd);
      if (idr) return idr;
      calls.push(cmd);
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
    const c = await client(fakeBridge((cmd) => identityFetch(cmd) ?? (calls.push(cmd), { id: '2', ok: true, status: 200, data: pageResp('k', 1, 20, 20, false) })));
    const r: any = await c.callTool({ name: 'get_page', arguments: { searchKey: 'k', page: 1, limit: 30 } });
    expect(r.isError).toBe(true);
    // 차단됐으니 API 호출 자체가 없어야 한다
    expect(calls.filter((c) => c.type === 'fetch')).toHaveLength(0);
  });

  it('없는 정렬값이면 MCP단에서 막는다', async () => {
    const calls: any[] = [];
    const c = await client(fakeBridge((cmd) => identityFetch(cmd) ?? (calls.push(cmd), { id: '2', ok: true, status: 200, data: pageResp('k', 1, 20, 20, false) })));
    const r: any = await c.callTool({ name: 'get_page', arguments: { searchKey: 'k', sort: 'NOPE_DESC' } });
    expect(r.isError).toBe(true);
    expect(calls.filter((c) => c.type === 'fetch')).toHaveLength(0);
  });

  it('GET 4xx(키 만료)면 캐시된 조건으로 재검색 후 해당 페이지를 반환한다', async () => {
    const calls: any[] = [];
    let postCount = 0;
    const c = await client(fakeBridge((cmd) => {
      const idr = identityFetch(cmd);
      if (idr) return idr;
      calls.push(cmd);
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
      const idr = identityFetch(cmd);
      if (idr) return idr;
      calls.push(cmd);
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

describe('search_consume / search_cash / search_etc (소비·캐시·기타 검색)', () => {
  const searchBridge = (calls: any[]) =>
    fakeBridge((cmd) => {
      const idr = identityFetch(cmd);
      if (idr) return idr;
      calls.push(cmd);
      if (cmd.method === 'GET') return { id: '3', ok: true, status: 200, data: { search: { limit: 100, remaining: 97 } } };
      return { id: '2', ok: true, status: 201, data: pageResp('key-c', 1, 10, 176, false) };
    });

  it('search_consume: 하위 분류로 POST 바디를 만들고 sold=true면 시세 URL을 쓴다', async () => {
    const calls: any[] = [];
    const c = await client(searchBridge(calls));
    await c.callTool({ name: 'search_consume', arguments: { subCategory: 'CONSUME_SCROLL_FLAME', sold: true } });
    const post = calls.find((c) => c.type === 'fetch' && c.method === 'POST');
    expect(post.url).toContain('/searches/sold/tool-tip');
    expect(post.body.filters.itemCategory).toEqual({ itemDetailCategory: 'CONSUME_SCROLL_FLAME' });
  });

  it('search_cash: 성별·라벨·펫 등급·기간제 옵션을 실측 바디로 변환한다', async () => {
    const calls: any[] = [];
    const c = await client(searchBridge(calls));
    await c.callTool({
      name: 'search_cash',
      arguments: {
        subCategory: 'CASH',
        gender: '남',
        itemGrade: '블랙라벨',
        periodOptions: [{ option: 'periodStr', minValue: 11 }],
      },
    });
    const post = calls.find((c) => c.type === 'fetch' && c.method === 'POST');
    // 2026-07-10 웹 거래소 캡처와 동일한 형태
    expect(post.body.filters.itemCategory).toEqual({ itemDetailCategory: 'CASH' });
    expect(post.body.filters.basicOption).toEqual({ gender: 'MALE', royalSpecialType: 2 });
    expect(post.body.filters.cashOption).toEqual({ periodStr: 11 });
  });

  it('search_cash: 펫 등급을 숫자 코드로 변환한다 (루나 스윗 = 4)', async () => {
    const calls: any[] = [];
    const c = await client(searchBridge(calls));
    await c.callTool({ name: 'search_cash', arguments: { subCategory: 'CASH_PET_PET', petGrade: '루나 스윗' } });
    const post = calls.find((c) => c.type === 'fetch' && c.method === 'POST');
    expect(post.body.filters.basicOption).toEqual({ petGrade: 4 });
  });

  it('search_etc: 결과 과다(422 code 4040)면 소진 없음 + 좁히기 안내를 반환한다', async () => {
    const c = await client(
      fakeBridge((cmd) => {
        const idr = identityFetch(cmd);
        if (idr) return idr;
        return { id: '2', ok: false, code: 'HTTP_ERROR', status: 422, error: 'HTTP 422', data: { code: 4040 } };
      })
    );
    const r = await c.callTool({ name: 'search_etc', arguments: { subCategory: 'ETC' } });
    expect(textOf(r)).toContain('검색 결과가 너무 많아');
    expect(textOf(r)).toContain('소진 없음');
  });
});

// 인증 API를 흉내내는 브리지: accounts / gameWorlds/{5,45}에 캐릭터가 있다
function authBridge(extra?: (cmd: any) => AuctionReply | null): AuctionTransport {
  return fakeBridge((cmd: any) => {
    const hit = extra?.(cmd);
    if (hit) return hit;
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
    const refreshSnapshot = vi.fn(async (name: string) => ({
      name,
      job: '카데나',
      level: 200,
      stats: { 기본: {}, AP: {} },
      equipment: { item_equipment: [] } as unknown as ItemEquipmentRes,
    }));
    const c = await client(
      authBridge((cmd: any) => {
        if (cmd.type === 'fetch' && cmd.method === 'POST' && /tool-tip/.test(cmd.url)) {
          posts.push(cmd.body);
          return { id: '6', ok: true, status: 201, data: pageResp('k', 1, 10, 1, false) };
        }
        if (cmd.type === 'fetch' && /daily-limit/.test(cmd.url)) return { id: '7', ok: true, data: { search: { remaining: 1 } } };
        return null;
      }),
      refreshSnapshot,
      refreshSnapshot
    );
    const r = await c.callTool({ name: 'set_character', arguments: { characterName: '에오스캐릭' } });
    expect(JSON.parse(textOf(r)).switched.world).toBe('에오스');
    expect(refreshSnapshot).toHaveBeenCalledWith('에오스캐릭');
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
      const idr = identityFetch(cmd);
      if (idr) return idr;
      calls.push(cmd);
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
  it('넥슨 API 키가 없으면 발급 URL과 유저 스코프 재등록 설정법을 반환한다', async () => {
    const savedKey = process.env.NEXON_DEVELOPER_KEY;
    delete process.env.NEXON_DEVELOPER_KEY;
    try {
      const c = await client(fakeBridge((cmd) => identityFetch(cmd) ?? { id: '2', ok: true }));

      const result = await c.callTool({ name: 'get_status', arguments: {} });
      const parsed = JSON.parse(textOf(result));

      expect(parsed.nexonOpenApi).toMatchObject({
        configured: false,
        setup: {
          issueUrl: 'https://openapi.nexon.com',
          claudeCode: expect.stringContaining('claude mcp add --scope user'),
          environmentVariable: 'NEXON_DEVELOPER_KEY',
        },
      });
      // 키 없이 돌아가는 동안 결과가 어떻게 왜곡되는지도 알려야 AI가 전투력만으로 순위를 매기지 않는다.
      expect(parsed.nexonOpenApi.degradedResults).toContain('finalDamageChangeRate');
      expect(parsed.nexonOpenApi).not.toHaveProperty('apiKey');
    } finally {
      if (savedKey === undefined) delete process.env.NEXON_DEVELOPER_KEY;
      else process.env.NEXON_DEVELOPER_KEY = savedKey;
    }
  });

  it('현재 캐릭터가 확인되면 응답을 기다리지 않고 캐시 재갱신을 시작한다', async () => {
    const refreshSnapshot = vi.fn(async (name: string) => ({
      name,
      job: '카데나',
      level: 290,
      stats: { 기본: {}, AP: {} },
      equipment: { item_equipment: [] } as unknown as ItemEquipmentRes,
    }));
    const c = await client(
      fakeBridge((cmd) => {
        if (/\/accounts$/.test(cmd.url)) {
          return { id: 'a', ok: true, status: 200, data: { accounts: [{ accountId: 1 }] } };
        }
        const world = cmd.url.match(/gameWorlds\/(\d+)\/characters$/);
        if (world) {
          return world[1] === '5'
            ? {
                id: 'c',
                ok: true,
                status: 200,
                data: { characters: [{ characterId: 2, characterName: '상태캐릭터', level: 290 }] },
              }
            : { id: 'c', ok: false, code: 'HTTP_ERROR', status: 500, error: 'HTTP 500' };
        }
        return { id: 's', ok: true, status: 200, data: { search: { remaining: 99 } } };
      }),
      refreshSnapshot,
      refreshSnapshot
    );

    const result = await c.callTool({ name: 'get_status', arguments: {} });

    expect(JSON.parse(textOf(result)).state).toBe('ready');
    expect(refreshSnapshot).toHaveBeenCalledWith('상태캐릭터');
  });

  it('세션이 살아있으면 state ready + identity를 반환한다', async () => {
    const c = await client(fakeBridge((cmd) => identityFetch(cmd) ?? { id: '2', ok: true }));
    const r = await c.callTool({ name: 'get_status', arguments: {} });
    expect(textOf(r)).toContain('"connected": true');
    expect(textOf(r)).toContain('"state": "ready"');
    expect(textOf(r)).toContain('"accountId": 1');
  });

  it('ready면 메소·메포(maplePoint) 잔액을 함께 반환한다', async () => {
    const c = await client(fakeBridge((cmd) => {
      const idr = identityFetch(cmd);
      if (idr) return idr;
      if (cmd.url.includes('/balance')) return { id: 'b', ok: true, status: 200, data: { meso: '1553441601', maplePoint: 1361 } };
      return { id: '2', ok: true, status: 200, data: { search: { remaining: 99 } } };
    }));
    const r = await c.callTool({ name: 'get_status', arguments: {} });
    const p = JSON.parse(textOf(r));
    expect(p.balance).toEqual({ meso: 1553441601, maplePoint: 1361 });
  });

  it('확장 미연결이면 state no_extension + 안내를 반환한다', async () => {
    const c = await client({ connected: false, request: async () => ({ id: '', ok: false, code: 'DISCONNECTED', error: '미연결' }) });
    const r = await c.callTool({ name: 'get_status', arguments: {} });
    expect(textOf(r)).toContain('"state": "no_extension"');
    expect(textOf(r)).toContain('확장');
  });

  // 세션 단일 활성: 다른 곳에서 새 세션이 생기면 기존 세션이 소리 없이 죽는다.
  // identity 캐시만 믿고 정상으로 보고하면 안 되고, 무료 GET 실측이 401이면 만료로 보고해야 한다.
  it('identity가 있어도 라이브 GET이 401이면 state session_expired + 옥션 페이지 안내', async () => {
    const c = await client(fakeBridge((cmd) => {
      const idr = identityFetch(cmd);
      if (idr) return idr;
      return { id: '2', ok: false, code: 'HTTP_ERROR', status: 401, error: 'HTTP 401', data: { code: 12 } };
    }));
    const r = await c.callTool({ name: 'get_status', arguments: {} });
    expect(textOf(r)).toContain('"state": "session_expired"');
    expect(textOf(r)).toContain('auction.maplestory.nexon.com');
    expect(textOf(r)).toContain('API code 12');
  });

  it('신원 발견이 실패하면 state no_session + 옥션 페이지 안내', async () => {
    const c = await client(fakeBridge((cmd) => {
      // 발견 체인의 /accounts가 401 → 세션 없음
      if (/\/accounts$/.test(cmd.url)) return { id: '1', ok: false, code: 'HTTP_ERROR', status: 401, error: 'HTTP 401', data: { code: 12 } };
      return { id: '2', ok: true };
    }));
    const r = await c.callTool({ name: 'get_status', arguments: {} });
    expect(textOf(r)).toContain('"state": "no_session"');
    expect(textOf(r)).toContain('auction.maplestory.nexon.com');
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

// 하네스: 모델 지침이 아니라 서버 구조로 검색 횟수를 아끼고(dedup), 오판을 막는(note) 장치.
describe('검색 하네스 (dedup · note)', () => {
  // 신원 체인 + POST(tool-tip) + GET(daily-limit) + GET(searches/{key})을 처리하는 브리지
  function dedupBridge(opts?: { failPageGet?: boolean; total?: number; count?: number }) {
    const calls: any[] = [];
    let postCount = 0;
    const bridge = fakeBridge((cmd: any) => {
      const idr = identityFetch(cmd);
      if (idr) return idr;
      calls.push(cmd);
      if (cmd.method === 'POST') {
        postCount += 1;
        return { id: '2', ok: true, status: 201, data: pageResp(`key-${postCount}`, 1, opts?.count ?? 10, opts?.total ?? 146, true) };
      }
      if (/daily-limit/.test(cmd.url)) return { id: '3', ok: true, status: 200, data: { search: { limit: 100, remaining: 97 } } };
      if (/\/searches\//.test(cmd.url)) {
        if (opts?.failPageGet) return { id: '4', ok: false, code: 'HTTP_ERROR', status: 404, error: 'HTTP 404' };
        return { id: '4', ok: true, status: 200, data: pageResp('key-1', 1, 20, opts?.total ?? 146, true) };
      }
      return { id: '9', ok: true };
    });
    return { bridge, calls, posts: () => calls.filter((c) => c.type === 'fetch' && c.method === 'POST') };
  }

  it('같은 조건을 다시 검색하면 POST 없이 기존 searchKey를 재사용하고 note로 알린다', async () => {
    const { bridge, posts } = dedupBridge();
    const c = await client(bridge);
    await c.callTool({ name: 'search_items', arguments: { keyword: '아케인셰이드 체인' } });
    const r2 = await c.callTool({ name: 'search_items', arguments: { keyword: '아케인셰이드 체인' } });
    const parsed = JSON.parse(textOf(r2));
    expect(parsed.searchKey).toBe('key-1');
    expect(parsed.note).toContain('재사용');
    expect(posts()).toHaveLength(1); // 두 번째 검색은 POST(소진) 없음
  });

  it('조건이 다르면 새로 POST한다', async () => {
    const { bridge, posts } = dedupBridge();
    const c = await client(bridge);
    await c.callTool({ name: 'search_items', arguments: { keyword: 'a' } });
    const r2 = await c.callTool({ name: 'search_items', arguments: { keyword: 'b' } });
    expect(JSON.parse(textOf(r2)).searchKey).toBe('key-2');
    expect(posts()).toHaveLength(2);
  });

  it('재사용 GET이 실패(키 만료)하면 POST로 폴백한다', async () => {
    const { bridge, posts } = dedupBridge({ failPageGet: true });
    const c = await client(bridge);
    await c.callTool({ name: 'search_items', arguments: { keyword: 'x' } });
    const r2 = await c.callTool({ name: 'search_items', arguments: { keyword: 'x' } });
    expect(JSON.parse(textOf(r2)).searchKey).toBe('key-2');
    expect(posts()).toHaveLength(2);
  });

  it('0건이면 검색 횟수가 소진됐음을 note로 알린다', async () => {
    const { bridge } = dedupBridge({ total: 0, count: 0 });
    const c = await client(bridge);
    const r = await c.callTool({ name: 'search_weapon', arguments: { keyword: '없는아이템' } });
    expect(JSON.parse(textOf(r)).note).toContain('0건');
  });

  it('필터 없는 장비 검색이 대량이면 노작 매물 경고 note를 붙인다', async () => {
    const { bridge } = dedupBridge({ total: 300 });
    const c = await client(bridge);
    const r = await c.callTool({ name: 'search_weapon', arguments: { subCategory: 'WEAPON_ONE_HANDED_CHAIN' } });
    expect(JSON.parse(textOf(r)).note).toContain('노작');
  });

  it('필터(잠재등급 등)를 걸면 노작 note가 없다', async () => {
    const { bridge } = dedupBridge({ total: 300 });
    const c = await client(bridge);
    const r = await c.callTool({ name: 'search_weapon', arguments: { subCategory: 'WEAPON_ONE_HANDED_CHAIN', potentialGrade: 4 } });
    expect(JSON.parse(textOf(r)).note).toBeUndefined();
  });

  it('get_page: 결과 500건 초과 + ATTACK_POWER_DESC면 정렬 미적용 note', async () => {
    const c = await client(fakeBridge((cmd: any) => {
      const idr = identityFetch(cmd);
      if (idr) return idr;
      return { id: '2', ok: true, status: 200, data: pageResp('k', 1, 20, 600, true) };
    }));
    const r = await c.callTool({ name: 'get_page', arguments: { searchKey: 'k', sort: 'ATTACK_POWER_DESC' } });
    expect(JSON.parse(textOf(r)).note).toContain('정렬');
  });

  it('get_page: 500건 이하면 정렬 note가 없다', async () => {
    const c = await client(fakeBridge((cmd: any) => {
      const idr = identityFetch(cmd);
      if (idr) return idr;
      return { id: '2', ok: true, status: 200, data: pageResp('k', 1, 20, 400, true) };
    }));
    const r = await c.callTool({ name: 'get_page', arguments: { searchKey: 'k', sort: 'ATTACK_POWER_DESC' } });
    expect(JSON.parse(textOf(r)).note).toBeUndefined();
  });
});

// Anthropic 디렉토리 심사 pass/fail 기준 (mcp-server-dev 스킬 references/tool-design.md):
// 모든 도구에 title·readOnlyHint·destructiveHint, 설명에 행동 지시 금지(프롬프트 인젝션 간주).
describe('디렉토리 심사 기준 (공개 배포)', () => {
  const WRITE_TOOLS = new Set(['add_wishlist', 'remove_wishlist', 'set_character', 'refresh_character']);

  it('모든 도구에 title과 readOnlyHint·destructiveHint annotation이 있다', async () => {
    const c = await client(fakeBridge(() => ({ id: '1', ok: true })));
    const { tools } = await c.listTools();
    expect(tools.length).toBeGreaterThan(0);
    for (const t of tools) {
      expect(t.title, `${t.name}: title`).toBeTruthy();
      expect(typeof t.annotations?.readOnlyHint, `${t.name}: readOnlyHint`).toBe('boolean');
      expect(typeof t.annotations?.destructiveHint, `${t.name}: destructiveHint`).toBe('boolean');
      expect(t.annotations?.readOnlyHint, `${t.name}: 읽기/쓰기 분류`).toBe(!WRITE_TOOLS.has(t.name));
    }
  });

  it('도구 설명에 행동 지시형 문구가 없다', async () => {
    const c = await client(fakeBridge(() => ({ id: '1', ok: true })));
    const { tools } = await c.listTools();
    for (const t of tools) {
      expect(t.description, `${t.name}: 행동 지시 금지`).not.toMatch(/반드시|필수|하세요|할 것|말 것|금지/);
    }
  });
});
