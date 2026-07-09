import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { BridgeCommandInput, BridgeReply, Identity } from '@maple/shared';
import {
  buildCreateBody,
  buildPageUrl,
  parseItemId,
  buildWishlistGetUrl,
  buildWishlistBody,
  buildWishlistDeleteUrl,
  SEARCH_URL,
  SOLD_SEARCH_URL,
  RECENT_SOLD_URL,
  DAILY_LIMIT_URL,
  WISHLIST_URL,
  WISHLIST_MAX,
  SORTS,
  type SearchParams,
  type Sort,
  type GetLimit,
} from './mapping.js';
import { summarizeSearch, summarizeItem } from './summarize.js';
import { listCharacters, type CharacterInfo } from './characters.js';
import { fetchScouter, swapDelta380, categoryToSlots, slotLabel } from './hwansan2/index.js';
import {
  worldName,
  POTENTIAL_OPTION_KEYS,
  EX_OPTION_KEYS,
  SCROLL_OPTION_KEYS,
  ARMOR_CATEGORY_KEYS,
  WEAPON_CATEGORY_KEYS,
  JOB_CLASSES,
} from './constants.js';

export interface BridgeLike {
  readonly connected: boolean;
  request(cmd: BridgeCommandInput, timeoutMs?: number): Promise<BridgeReply>;
}

function text(value: unknown) {
  return { content: [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value, null, 1) }] };
}

function errorText(reply: Extract<BridgeReply, { ok: false }>): string {
  if (reply.status === 403) {
    return '넥슨 로그인이 필요합니다. 크롬에서 https://nxlogin.nexon.com/auth/login 에 접속해 로그인한 뒤 다시 시도하세요.';
  }
  const apiCode = (reply.data as { code?: number } | null)?.code;
  const suffix = apiCode != null ? ` (API code ${apiCode})` : '';
  return `요청 실패 (${reply.code}): ${reply.error}${suffix}`;
}

// ── 공통 필터 zod 스키마 (실측 스펙: docs/API.md) ──────────────────────────────

const enumOf = (keys: string[]) => z.enum(keys as [string, ...string[]]);

const gradeDesc = '0없음 1레어 2에픽 3유니크 4레전드리';

function optionRows(keys: string[], what: string, keyDesc: string) {
  return z
    .array(
      z.object({
        option: enumOf(keys).describe(`${what} 옵션 키. ${keyDesc}`),
        minValue: z.number().describe('최소값'),
      })
    )
    .optional();
}

// search_armor / search_weapon 이 공유하는 상세 필터
const detailFilterSchema = {
  keyword: z.string().optional().describe('아이템 이름 검색어 (필터만으로 검색하려면 생략)'),
  exactMatch: z.boolean().optional().describe('이름 정확히 일치 (기본 false)'),
  jobClass: z.enum(JOB_CLASSES).optional().describe('직업군'),
  priceMin: z.number().int().optional().describe('최소 가격 (메소)'),
  priceMax: z.number().int().optional().describe('최대 가격 (메소)'),
  levelMin: z.number().int().optional().describe('아이템 착용 레벨 최소'),
  levelMax: z.number().int().optional().describe('아이템 착용 레벨 최대'),
  starforceMin: z.number().int().optional().describe('스타포스 최소'),
  starforceMax: z.number().int().optional().describe('스타포스 최대'),
  potentialGrade: z.number().int().min(0).max(4).optional().describe(`잠재등급: ${gradeDesc}`),
  additionalPotentialGrade: z.number().int().min(0).max(4).optional().describe(`에디셔널 등급: ${gradeDesc}`),
  potentialOptions: optionRows(
    POTENTIAL_OPTION_KEYS,
    '잠재',
    '키는 영문 의미 그대로(*Percent=%줄, 접미사 없음=수치줄). 비자명: skillLevelIncrease=4차 이하 스킬 레벨, hpRecovery/mpRecovery=공격 시 회복, *Skill=쓸만한 버프, *PerLevel=9레벨 당 스탯(에디셔널 전용)'
  ),
  potentialSum: z.boolean().optional().describe('여러 줄 합산 여부 (기본 true). 예: 공9%+공12%→합 21%'),
  additionalPotentialOptions: optionRows(POTENTIAL_OPTION_KEYS, '에디셔널 잠재', 'potentialOptions와 동일한 키'),
  additionalPotentialSum: z.boolean().optional().describe('합산 여부 (기본 true)'),
  extraOptions: optionRows(EX_OPTION_KEYS, '추가 옵션(추옵)', 'ex+스탯명. exReducedLevelReq=착용 제한 레벨 감소'),
  scrollOptions: optionRows(SCROLL_OPTION_KEYS, '주문서 강화 누적', 'scroll+스탯명'),
  remainUpgradeCountMin: z.number().int().optional().describe('주문서 강화 잔여 횟수 최소'),
  remainUpgradeCountMax: z.number().int().optional().describe('주문서 강화 잔여 횟수 최대'),
  cuttableCountMin: z.number().int().optional().describe('가위(재거래) 가능 횟수 최소'),
  cuttableCountMax: z.number().int().optional().describe('가위 가능 횟수 최대'),
  uncuttable: z.boolean().optional().describe('가위 횟수 미부여만 (cuttableCount와 동시 사용 불가)'),
  isBindedWhenEquipped: z.boolean().optional().describe('장착 시 교환 불가 아이템만'),
  isExOptExtractable: z.boolean().optional().describe('추가 옵션 추출 가능만'),
  isPotentialExtractable: z.boolean().optional().describe('잠재능력 추출 가능만'),
  myWorldOnly: z.boolean().optional().describe('현재 캐릭터 월드의 매물만'),
  sold: z.boolean().optional().describe('true면 같은 필터로 판매 완료 매물(시세) 검색. 기본 false(판매 중)'),
};

// 반지 전용이지만 방어구 스키마에 포함
const seedRingSchema = {
  seedRingLevelMin: z.number().int().optional().describe('특수 스킬 반지 레벨 최소 (반지 전용)'),
  seedRingLevelMax: z.number().int().optional().describe('특수 스킬 반지 레벨 최대 (반지 전용)'),
};

export function createServer(bridge: BridgeLike): McpServer {
  // 클라이언트가 시스템 프롬프트에 주입하는 서버 사용 상식. 한국어 유지 — 응답·필터가 전부 한국어라 톤을 맞추고,
  // 방무·공퍼·보공·메획·아획 같은 단축어를 모델에 학습시키는 의미도 있음. (압축 유지)
  const instructions = [
    '메이플스토리(KMS) 거래소 검색 MCP. 사용 시 알아야 할 게임 상식:',
    '[거래 규칙]',
    '- 타 월드 매물 구매 시 가격의 10% 메포 추가 수수료.',
    '- 판매 수수료 3~5% (MVP 실버 이상 3%).',
    '- 가위는 장착 후 재거래 가능 횟수 (개당 5,900메포), 잔여 횟수 0에 가까울수록 가치가 비선형적으로 급락.',
    '- 메소↔메이플포인트 공식 교환 가능',
    '[아이템 판단]',
    '- 공퍼·데미지·방무는 무기·보조·엠블렘에만, 보공은 무기·보조에만(엠블렘 X).',
    '- 메획·아획은 (귀고리·반지·얼장·눈장·펜던트)에만 뜸.',
    '- 반지 4개·펜던트 2개 착용가능.',
    '- 같은 이름 아이템도 잠재·추옵·스타포스 여부에 따라 가격이 수백 배 차이.',
    '- 제네시스는 교불',
    '- 전투력은 보공/방무 반영 안됌 신뢰금지',
    '- 공격력·보공·방무 옵션 효율은 눈대중 대신 item_hwansan으로 환산 비교. 단 매물·부위당 외부 계산 API 1회씩이니 가격·옵션으로 후보를 먼저 추려 소수만, 부위가 정해졌으면 slot을 지정해 호출 최소화.',
    '[검색 횟수 (일 100회)]',
    '- 첫 검색 전 get_status로 검색 기준 캐릭터를 확인해 월드·닉네임을 사용자에게 알리고 시작. 다른 월드를 원하면 set_character 후 검색.',
    '- search_items/search_weapon/search_armor만 1회 소진(sold=true 시세 포함). 나머지 도구는 소진 없음.',
    '- 같은 조건 재조회는 재검색 대신 searchKey + get_page.',
    '[응답 해석]',
    '- isAmazingHyperUpgradeUsed=true는 놀장(놀라운 장비강화 주문서) 사용 장비: 성 수 대비 스탯이 높아 보이지만 스타포스 최대 15성 제한이 있어 보통 저평가되니 가격 비교 시 주의.',
    '- powerDiff(전투력 증가량)는 캐릭터 마지막 로그아웃 시점 기준.',
    '- 매물 id("ynoFBr…:1" 류)는 도구 호출용 내부 값 — 사용자에게 노출하지 말 것. 매물 지칭은 특징 별칭("22성 체인", "올이탈", "54억 무기" 식)으로 하고, 별칭↔id 대응은 네가 기억해라.',
    '- 가위(재거래) 잔여 횟수가 낮은 매물은 사용자에게 꼭 명시(tradeDesc 참고 — 가치 급락 요인).',
  ].join('\n');

  const server = new McpServer({ name: 'maple-auction', version: '0.4.0' }, { instructions });

  let identity: (Identity & { characterName?: string }) | null = null;
  let characters: CharacterInfo[] | null = null;
  const bodyCache = new Map<string, { body: ReturnType<typeof buildCreateBody>; sold: boolean; category?: string }>();

  // 원본 매물 캐시(id → 원본 + 검색 카테고리). item_hwansan이 단일 매물의 부위별 Δ환산을
  // 온디맨드로 계산할 때 쓴다. 검색·페이지 조회가 지날 때마다 채워지고, 상한 초과 시 오래된 것부터 버린다.
  const rawItemCache = new Map<string, { raw: any; category?: string }>();
  const RAW_ITEM_CACHE_MAX = 300;
  function cacheRawItems(items: any[] | undefined, category?: string) {
    for (const it of items ?? []) {
      if (!it?._id) continue;
      rawItemCache.set(it._id, { raw: it, category });
      if (rawItemCache.size > RAW_ITEM_CACHE_MAX) {
        const oldest = rawItemCache.keys().next().value;
        if (oldest !== undefined) rawItemCache.delete(oldest);
      }
    }
  }

  async function ensureIdentity(): Promise<Identity | string> {
    if (identity) return identity;
    const reply = await bridge.request({ type: 'discover' });
    if (reply.ok && reply.data) {
      identity = reply.data as Identity & { characterName?: string };
      return identity;
    }
    const env = process.env.MAPLE_IDENTITY;
    if (env) {
      identity = JSON.parse(env) as Identity;
      return identity;
    }
    return reply.ok
      ? '계정 정보를 찾지 못했습니다.'
      : `계정 정보를 찾지 못했습니다: ${errorText(reply)}`;
  }

  // 남은 일일 검색 생성 횟수 (GET, 무료). 실패하면 null.
  async function searchRemaining(): Promise<number | null> {
    const dl = await bridge.request({ type: 'fetch', url: DAILY_LIMIT_URL, method: 'GET' });
    return dl.ok ? ((dl.data as any)?.search?.remaining ?? null) : null;
  }

  // POST: 세션 생성. 정렬·페이지 선택 없이 가격낮은순 10개만 반환한다. 더 보려면 get_page(GET).
  // sold=true면 판매 완료(시세) 검색. body는 동일하고 URL만 다르다.
  async function runSearch(params: SearchParams, sold = false) {
    const id = await ensureIdentity();
    if (typeof id === 'string') return text(id);
    const body = buildCreateBody(params, id);
    const created = await bridge.request({ type: 'fetch', url: sold ? SOLD_SEARCH_URL : SEARCH_URL, method: 'POST', body });
    if (!created.ok) return text(errorText(created));
    const data = created.data as any;
    if (data?.searchKey) bodyCache.set(data.searchKey, { body, sold, category: params.category });
    cacheRawItems(data?.items, params.category);
    return text({ ...summarizeSearch(data), searchRemaining: await searchRemaining() });
  }

  // 찜 목록 개수·남은 슬롯을 조회한다(무료 GET). 실패 시 에러 문자열.
  async function wishlistState(id: Identity): Promise<{ count: number; remaining: number; items: unknown[] } | string> {
    const reply = await bridge.request({ type: 'fetch', url: buildWishlistGetUrl(id), method: 'GET' });
    if (!reply.ok) return errorText(reply);
    const items = ((reply.data as any)?.items ?? []) as unknown[];
    return { count: items.length, remaining: Math.max(0, WISHLIST_MAX - items.length), items };
  }

  // 단일 매물의 부위별 Δ환산380(maplescouter 교체 시뮬레이터 기준)을 계산한다.
  // 원본 매물은 직전 검색(search_*/get_page)이 rawItemCache에 넣어둔 것을 쓴다. 에러는 안내 문자열로 반환.
  async function computeItemHwansan(itemId: string, onlySlot?: string): Promise<unknown> {
    const entry = rawItemCache.get(itemId);
    if (!entry) {
      return '해당 매물의 원본을 찾을 수 없습니다. 먼저 search_weapon / search_armor / get_page 로 이 매물을 조회한 뒤 그 id로 다시 호출하세요.';
    }
    const slots = categoryToSlots(entry.category);
    if (!slots) {
      return '이 매물은 환산 비교 대상(장비)이 아니거나 카테고리를 알 수 없습니다. search_weapon / search_armor 로 조회한 매물의 id를 사용하세요.';
    }
    let targetSlots = slots;
    if (onlySlot) {
      targetSlots = slots.filter((s) => slotLabel(s) === onlySlot || s === onlySlot);
      if (!targetSlots.length) {
        return `slot "${onlySlot}" 는 이 매물의 착용 부위가 아닙니다. 가능한 부위: ${slots.map(slotLabel).join(', ')}`;
      }
    }
    const name = identity?.characterName;
    if (!name) {
      return '현재 캐릭터 이름을 알 수 없어 환산을 계산할 수 없습니다. set_character 로 기준 캐릭터를 지정하세요.';
    }
    let data;
    try {
      data = await fetchScouter(name);
    } catch (e) {
      return `환산 계산기(maplescouter) 호출 실패: ${(e as Error).message}`;
    }
    const bySlot: Record<string, number> = {};
    const unknown = new Set<string>();
    for (const slot of targetSlots) {
      try {
        const r = await swapDelta380(data, slot, entry.raw);
        if (r) {
          bySlot[slotLabel(slot)] = r.delta380;
          for (const u of r.unknown) unknown.add(u);
        }
      } catch { /* 개별 부위 실패는 생략 */ }
    }
    return {
      id: itemId,
      name: entry.raw?.itemName ?? null,
      hwansan380: data.calculatedData.boss380_stat,
      bySlot,
      ...(unknown.size ? { unknown: [...unknown] } : {}),
    };
  }

  server.registerTool(
    'search_items',
    {
      title: '거래소 빠른 검색 (이름 위주)',
      description:
        '아이템 이름으로 거래소 빠른 검색. 가격 낮은순 10개와 searchKey 반환, 추가 페이지·정렬은 get_page. 잠재·추옵·가격 등 상세 필터는 search_weapon/search_armor.',
      inputSchema: {
        keyword: z.string().describe('아이템 이름 검색어'),
        exactMatch: z.boolean().optional().describe('정확히 일치 (기본 false)'),
        category: z.string().optional().describe("카테고리 코드. search_weapon/search_armor의 subCategory와 같은 체계 (예: 'WEAPON')"),
        potentialGrade: z.number().int().min(0).max(4).optional().describe(`잠재등급: ${gradeDesc}`),
        myWorldOnly: z.boolean().optional().describe('현재 캐릭터 월드의 매물만'),
      },
    },
    async (params) => runSearch(params as SearchParams)
  );

  server.registerTool(
    'search_weapon',
    {
      title: '무기 상세 검색 (전체 필터)',
      description:
        '무기 상세 필터 검색. 잠재/에디셔널은 [{option, minValue}] 배열(기본 합산 모드). 예: 에디 공퍼 합 21%↑ 체인 → subCategory:"WEAPON_ONE_HANDED_CHAIN", additionalPotentialOptions:[{option:"physicalAttackPercent", minValue:21}]. 시세(판매 완료가)는 sold=true.',
      inputSchema: {
        subCategory: enumOf(WEAPON_CATEGORY_KEYS)
          .default('WEAPON')
          .describe('무기 분류. 키=무기명(비자명: THROWING_GLOVE=아대, SCROLL=두루마리, DUAL_BOW=듀얼 보우건, CANE=케인). WEAPON_SUB=보조무기 전체'),
        ...detailFilterSchema,
      },
    },
    async ({ subCategory, sold, ...rest }) => runSearch({ ...(rest as SearchParams), category: subCategory as string }, sold)
  );

  server.registerTool(
    'search_armor',
    {
      title: '방어구·장신구 상세 검색 (전체 필터)',
      description:
        '방어구/장신구 상세 필터 검색. 잠재/에디셔널은 [{option, minValue}] 배열(기본 합산 모드). 시세(판매 완료가)는 sold=true.',
      inputSchema: {
        subCategory: enumOf(ARMOR_CATEGORY_KEYS)
          .default('ARMOR')
          .describe('방어구·장신구 분류. 키=부위명(비자명: LONGCOAT=한벌옷, FACE/EYE=얼굴/눈장식, DRAGON_CAP=드래곤 장비, MACHINE_HEART=기계 심장)'),
        ...detailFilterSchema,
        ...seedRingSchema,
      },
    },
    async ({ subCategory, sold, ...rest }) => runSearch({ ...(rest as SearchParams), category: subCategory as string }, sold)
  );

  server.registerTool(
    'get_page',
    {
      title: '검색 결과 페이지 조회 (정렬/페이지네이션)',
      description:
        'search_*가 반환한 searchKey로 정렬·페이지·크기 재조회(시세 키 포함). hasNext=true면 다음 페이지 존재. 키 만료 시 같은 조건으로 자동 재검색(이때만 1회 소진).',
      inputSchema: {
        searchKey: z.string().describe('검색 응답의 searchKey'),
        page: z.number().int().min(1).default(1),
        limit: z.union([z.literal(20), z.literal(40), z.literal(60)]).default(20).describe('페이지 크기'),
        sort: z
          .enum(SORTS)
          .default('PRICE_PER_ITEM_ASC')
          .describe(
            '정렬. PRICE_PER_ITEM_ASC=개당 낮은가격, ATTACK_POWER_DESC=전투력증가 높은순(결과 500개 이하일 때만 동작), END_DATE_ASC=종료 임박(급처), REGISTER_DATE_DESC=최신등록(스나이핑)'
          ),
      },
    },
    async ({ searchKey, page, limit, sort }) => {
      const id = await ensureIdentity();
      if (typeof id === 'string') return text(id);
      const q = { page, limit: limit as GetLimit, sort: sort as Sort };
      const cachedEntry = bodyCache.get(searchKey);
      const sold = cachedEntry?.sold ?? false;
      const reply = await bridge.request({ type: 'fetch', url: buildPageUrl(searchKey, q, id, sold), method: 'GET' });
      if (reply.ok) {
        cacheRawItems((reply.data as any)?.items, cachedEntry?.category);
        return text(summarizeSearch(reply.data));
      }

      // searchKey 만료 추정 → 캐시된 조건으로 재검색(POST) 후 해당 페이지 재조회 (라이브/시세 각각의 URL로)
      if (reply.code === 'HTTP_ERROR' && reply.status !== 403) {
        const cached = bodyCache.get(searchKey);
        if (cached) {
          const searchUrl = cached.sold ? SOLD_SEARCH_URL : SEARCH_URL;
          const recreated = await bridge.request({ type: 'fetch', url: searchUrl, method: 'POST', body: cached.body });
          const newKey: string | undefined = recreated.ok ? (recreated.data as any)?.searchKey : undefined;
          if (newKey) {
            bodyCache.set(newKey, cached);
            const retry = await bridge.request({ type: 'fetch', url: buildPageUrl(newKey, q, id, cached.sold), method: 'GET' });
            if (retry.ok) {
              cacheRawItems((retry.data as any)?.items, cached.category);
              return text(summarizeSearch(retry.data));
            }
          }
        }
      }
      return text(errorText(reply));
    }
  );

  server.registerTool(
    'item_hwansan',
    {
      title: '아이템 교체 환산 증감',
      description:
        '매물 1개를 현재 캐릭터의 해당 부위 장비와 교체할 때의 환산 주스탯(보스 380) 증감 계산. 공격력(깡·%)·보공·방무(곱연산)·크뎀·쿨감·세트효과까지 반영한 정확한 효율 (powerDiff 전투력은 보공·방무 미반영). 매물·부위당 외부 계산 API 1회.',
      inputSchema: {
        itemId: z.string().describe('매물 id (검색 결과의 id 필드, "TRADESN:SUBIDX" 형식)'),
        slot: z.string().optional().describe('특정 부위만 계산 (예: "반지1", "펜던트2"). 생략 시 착용 가능한 모든 부위'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ itemId, slot }) => {
      const id = await ensureIdentity();
      if (typeof id === 'string') return text(id);
      return text(await computeItemHwansan(itemId, slot));
    }
  );

  server.registerTool(
    'recent_sold',
    {
      title: '최근 시세 (판매 완료 매물)',
      description:
        '최근 판매 완료 매물(시세) 조회. 현재 검색 기준 캐릭터의 월드 기준. 특정 아이템·조건의 시세는 이 도구 말고 search_*에 sold=true.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const id = await ensureIdentity();
      if (typeof id === 'string') return text(id);
      const body = { worldId: id.worldId, accountId: id.accountId, characterId: id.characterId };
      const reply = await bridge.request({ type: 'fetch', url: RECENT_SOLD_URL, method: 'POST', body });
      if (!reply.ok) return text(errorText(reply));
      try {
        return text(summarizeSearch(reply.data));
      } catch {
        return text(reply.data); // 응답 형태가 검색과 다르면 원본 반환
      }
    }
  );

  server.registerTool(
    'get_wishlist',
    {
      title: '찜 목록 조회',
      description:
        `찜 목록과 남은 슬롯 조회 (최대 ${WISHLIST_MAX}개).`,
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const id = await ensureIdentity();
      if (typeof id === 'string') return text(id);
      const st = await wishlistState(id);
      if (typeof st === 'string') return text(st);
      return text({ count: st.count, remainingSlots: st.remaining, max: WISHLIST_MAX, items: st.items.map(summarizeItem) });
    }
  );

  server.registerTool(
    'add_wishlist',
    {
      title: '찜 목록에 추가',
      description:
        `매물을 찜 목록에 추가 (최대 ${WISHLIST_MAX}개, remainingSlots 반환). 중복이면 409, 다른 월드 그룹이면 실패.`,
      inputSchema: {
        itemId: z.string().describe('매물 id (검색 결과의 id 필드, "TRADESN:SUBIDX" 형식)'),
      },
    },
    async ({ itemId }) => {
      const id = await ensureIdentity();
      if (typeof id === 'string') return text(id);
      const { tradeSn, subIdx } = parseItemId(itemId);
      const reply = await bridge.request({
        type: 'fetch',
        url: WISHLIST_URL,
        method: 'POST',
        body: buildWishlistBody(id, tradeSn, subIdx),
      });
      if (!reply.ok) return text(errorText(reply));
      const st = await wishlistState(id);
      return text({
        added: true,
        tradeSn,
        subIdx,
        remainingSlots: typeof st === 'string' ? undefined : st.remaining,
        max: WISHLIST_MAX,
      });
    }
  );

  server.registerTool(
    'remove_wishlist',
    {
      title: '찜 목록에서 제거',
      description:
        '매물을 찜 목록에서 제거 (remainingSlots 반환).',
      inputSchema: {
        itemId: z.string().describe('매물 id (검색 결과 또는 get_wishlist의 id 필드)'),
      },
    },
    async ({ itemId }) => {
      const id = await ensureIdentity();
      if (typeof id === 'string') return text(id);
      const { tradeSn, subIdx } = parseItemId(itemId);
      const reply = await bridge.request({
        type: 'fetch',
        url: buildWishlistDeleteUrl(id, tradeSn, subIdx),
        method: 'DELETE',
      });
      if (!reply.ok) return text(errorText(reply));
      const st = await wishlistState(id);
      return text({
        removed: true,
        tradeSn,
        subIdx,
        remainingSlots: typeof st === 'string' ? undefined : st.remaining,
        max: WISHLIST_MAX,
      });
    }
  );

  server.registerTool(
    'list_characters',
    {
      title: '계정 캐릭터 목록',
      description:
        '넥슨 계정의 캐릭터를 월드별로 조회. 검색 기준 월드 전환은 set_character.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const result = await listCharacters(bridge);
      if (typeof result === 'string') return text(result);
      characters = result;
      const current = identity?.characterId;
      return text(
        result.map((c) => ({
          world: c.worldName,
          name: c.characterName,
          level: c.level,
          characterId: c.characterId,
          current: c.characterId === current || undefined,
        }))
      );
    }
  );

  server.registerTool(
    'set_character',
    {
      title: '검색 기준 캐릭터 전환',
      description:
        '검색 기준 캐릭터(=월드) 전환. 거래소는 월드 그룹 단위. 전환하면 이전 searchKey는 이전 월드 기준이 된다.',
      inputSchema: {
        characterName: z.string().optional().describe('캐릭터 이름 (정확히 일치)'),
        characterId: z.number().int().optional().describe('characterId (이름이 여러 월드에 있을 때)'),
      },
    },
    async ({ characterName, characterId }) => {
      if (!characterName && !characterId) return text('characterName 또는 characterId를 지정하세요.');
      if (!characters) {
        const result = await listCharacters(bridge);
        if (typeof result === 'string') return text(result);
        characters = result;
      }
      const matches = characters.filter(
        (c) => (characterId ? c.characterId === characterId : true) && (characterName ? c.characterName === characterName : true)
      );
      if (!matches.length) {
        return text(`일치하는 캐릭터가 없습니다. list_characters로 목록을 확인하세요.`);
      }
      if (matches.length > 1) {
        return text({
          note: '이름이 여러 캐릭터와 일치합니다. characterId로 지정하세요.',
          candidates: matches.map((c) => ({ world: c.worldName, name: c.characterName, level: c.level, characterId: c.characterId })),
        });
      }
      const c = matches[0];
      identity = { worldId: c.worldId, accountId: c.accountId, characterId: c.characterId, characterName: c.characterName };
      return text({ switched: { world: c.worldName, name: c.characterName, level: c.level, characterId: c.characterId } });
    }
  );

  server.registerTool(
    'get_status',
    {
      title: '연결 상태 확인',
      description: '크롬 확장 연결·넥슨 계정·현재 검색 기준 캐릭터(월드)·일일 검색 잔여 횟수 확인.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      if (!bridge.connected) {
        return text('크롬 확장이 연결되어 있지 않습니다. 크롬이 실행 중이고 Maple Auction Bridge 확장이 켜져 있는지 확인하세요.');
      }
      const id = await ensureIdentity();
      if (typeof id === 'string') return text({ connected: true, identity: null, note: id });
      const dl = await bridge.request({ type: 'fetch', url: DAILY_LIMIT_URL, method: 'GET' });
      return text({
        connected: true,
        identity: { ...id, worldName: worldName(id.worldId) },
        dailyLimit: dl.ok ? dl.data : undefined,
      });
    }
  );

  return server;
}
