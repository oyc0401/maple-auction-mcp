import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { BridgeCommandInput, BridgeReply, Identity } from '@maple/shared';
import { buildCreateBody, buildPageUrl, SEARCH_URL, RECENT_SOLD_URL, DAILY_LIMIT_URL, SORTS, type SearchParams, type Sort, type GetLimit } from './mapping.js';
import { summarizeSearch } from './summarize.js';
import { listCharacters, type CharacterInfo } from './characters.js';
import {
  worldName,
  labelList,
  POTENTIAL_OPTION_KEYS,
  POTENTIAL_OPTION_LABELS,
  EX_OPTION_KEYS,
  EX_OPTION_LABELS,
  SCROLL_OPTION_KEYS,
  SCROLL_OPTION_LABELS,
  ARMOR_CATEGORY_KEYS,
  ARMOR_CATEGORY_LABELS,
  WEAPON_CATEGORY_KEYS,
  WEAPON_CATEGORY_LABELS,
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
  return `요청 실패 (${reply.code}): ${reply.error}`;
}

// ── 공통 필터 zod 스키마 (실측 스펙: docs/API.md) ──────────────────────────────

const enumOf = (keys: string[]) => z.enum(keys as [string, ...string[]]);

const gradeDesc = '0없음 1레어 2에픽 3유니크 4레전드리';

function optionRows(keys: string[], labels: Record<string, string>, what: string) {
  return z
    .array(
      z.object({
        option: enumOf(keys).describe(`${what} 옵션 키. ${labelList(labels)}`),
        minValue: z.number().describe('최소값'),
      })
    )
    .optional();
}

// 매물을 반환하는 도구 설명에 공통으로 붙는 응답 해석 안내
const RESULT_NOTE =
  ' 응답 매물의 isAmazingHyperUpgradeUsed=true는 놀장(놀라운 장비강화 주문서) 사용 장비: 성 수 대비 스탯이 높아 보이지만 스타포스 최대 15성 제한이 있어 보통 저평가되니 가격 비교 시 주의. powerDiff(전투력 증가량)는 캐릭터 마지막 로그아웃 시점 기준.';

// search_armor / search_weapon 이 공유하는 상세 필터
const detailFilterSchema = {
  keyword: z.string().optional().describe('아이템 이름 검색어 (필터만으로 검색하려면 생략)'),
  exactMatch: z.boolean().optional().describe('이름 정확히 일치 (기본 false)'),
  jobClass: z.enum(JOB_CLASSES).optional().describe('직업군: WARRIOR전사 MAGE마법사 ARCHER궁수 THIEF도적 PIRATE해적'),
  priceMin: z.number().int().optional().describe('최소 가격 (메소)'),
  priceMax: z.number().int().optional().describe('최대 가격 (메소)'),
  levelMin: z.number().int().optional().describe('아이템 착용 레벨 최소'),
  levelMax: z.number().int().optional().describe('아이템 착용 레벨 최대'),
  starforceMin: z.number().int().optional().describe('스타포스 최소'),
  starforceMax: z.number().int().optional().describe('스타포스 최대'),
  potentialGrade: z.number().int().min(0).max(4).optional().describe(`잠재등급: ${gradeDesc}`),
  additionalPotentialGrade: z.number().int().min(0).max(4).optional().describe(`에디셔널 등급: ${gradeDesc}`),
  potentialOptions: optionRows(POTENTIAL_OPTION_KEYS, POTENTIAL_OPTION_LABELS, '잠재'),
  potentialSum: z.boolean().optional().describe('잠재 옵션 여러 줄 합산 여부 (기본 true). 예: 공9%+공12%를 합쳐 공21% 이상'),
  additionalPotentialOptions: optionRows(POTENTIAL_OPTION_KEYS, POTENTIAL_OPTION_LABELS, '에디셔널 잠재'),
  additionalPotentialSum: z.boolean().optional().describe('에디셔널 옵션 합산 여부 (기본 true)'),
  extraOptions: optionRows(EX_OPTION_KEYS, EX_OPTION_LABELS, '추가 옵션(추옵)'),
  scrollOptions: optionRows(SCROLL_OPTION_KEYS, SCROLL_OPTION_LABELS, '주문서 강화 누적'),
  remainUpgradeCountMin: z.number().int().optional().describe('주문서 강화 잔여 횟수 최소'),
  remainUpgradeCountMax: z.number().int().optional().describe('주문서 강화 잔여 횟수 최대'),
  cuttableCountMin: z.number().int().optional().describe('가위(재거래) 사용 가능 횟수 최소 — 많을수록 가치가 높다'),
  cuttableCountMax: z.number().int().optional().describe('가위 사용 가능 횟수 최대'),
  uncuttable: z.boolean().optional().describe('가위 사용 횟수 미부여만 (cuttableCount와 동시 사용 불가)'),
  isBindedWhenEquipped: z.boolean().optional().describe('장착 시 교환 불가 아이템만'),
  isExOptExtractable: z.boolean().optional().describe('추가 옵션 추출 가능만'),
  isPotentialExtractable: z.boolean().optional().describe('잠재능력 추출 가능만'),
  myWorldOnly: z.boolean().optional().describe('현재 캐릭터 월드의 매물만 (타 월드 매물은 구매 시 가격의 10% 메이플포인트 수수료)'),
};

// 반지 전용이지만 방어구 스키마에 포함
const seedRingSchema = {
  seedRingLevelMin: z.number().int().optional().describe('특수 스킬 반지 레벨 최소 (반지 전용)'),
  seedRingLevelMax: z.number().int().optional().describe('특수 스킬 반지 레벨 최대 (반지 전용)'),
};

export function createServer(bridge: BridgeLike): McpServer {
  // 클라이언트가 시스템 프롬프트에 주입하는 서버 사용 상식 (영문 본문 + 아래 한국어 번역 주석, 압축 유지)
  const instructions = [
    'MapleStory (KMS) auction house MCP. Game knowledge required to use it well:',
    '[Trading rules]',
    '- The auction is world-group scoped (Group 1: Scania~Challengers3 / Group 2: Eos, Helios, Challengers4).',
    '- Buying an item with isMyWorld=false costs an extra fee of 10% of its price in Maple Points. Always factor this into price comparisons.',
    '- Selling fee is 3-5% (3% with MVP Silver or higher).',
    '- tradeDesc scissors count = remaining re-trades after equipping. Scissors (Platinum Karma) cost 5,900 Maple Points each; value drops non-linearly and steeply as the remaining count approaches 0.',
    '- Meso and Maple Points are officially exchangeable (Meso Market), so MP fees can be valued in meso.',
    '[Price judgment]',
    '- Same-name items differ 10-100x in price by potential (boss dmg/IED/ATT%), additional potential (ATT%), flame stats, starforce, scissors count, and 놀장 - never quote a bare item\'s lowest price as the market price of an optioned one.',
    '- Snipe undervalued items: narrow with detail filters (additional potential ATT%, flames, scissors) then watch REGISTER_DATE_DESC (newest first); END_DATE_ASC surfaces urgent sellers.',
    '[Usage]',
    '- Search creation (POST) is limited to 100/day. Re-view the same search with get_page (free); check market prices with recent_sold (free) first.',
  ].join('\n');

  // instructions 한국어 번역
  // '메이플스토리(KMS) 거래소 검색 MCP. 사용 시 알아야 할 게임 상식:',
  // '[거래 규칙]',
  // '- 거래소는 월드 그룹 단위 (1그룹: 스카니아~챌린저스3 / 2그룹: 에오스·헬리오스·챌린저스4).',
  // '- isMyWorld=false(타 월드) 매물은 구매 시 가격의 10%만큼 메이플포인트 추가 수수료. 가격 비교 시 반드시 반영.',
  // '- 판매 수수료 3~5%(MVP등급 실버 이상 3%)',
  // '- tradeDesc의 가위는 장착 후 재거래 가능 횟수. 가위(플래티넘 카르마)는 개당 5,900메포, 잔여 횟수 0에 가까울수록 가치가 비선형적으로 급락',
  // '- 메소↔메이플포인트는 메소마켓에서 공식 교환 가능 → 메포 수수료도 메소로 환산해 비교 가능.',
  // '[시세 판단]',
  // '- 같은 이름 아이템도 잠재(보공·방무·공%)·에디셔널(공%)·추옵·스타포스·가위 잔여·놀장 여부에 따라 가격이 수십~수백 배 차이. 깡통 최저가를 옵션 매물 시세로 착각 금지.',
  // '- 저평가 스나이핑: 상세 필터(에디 공%, 추옵, 가위)로 좁힌 뒤 REGISTER_DATE_DESC(최신 등록순) 감시. END_DATE_ASC(마감 임박순)는 급처 매물 발굴용.',
  // '[사용 수칙]',
  // '- 검색 생성(POST)은 일 100회 제한. 같은 조건 재조회는 get_page(무료), 시세 파악은 recent_sold(무료) 우선.',

  const server = new McpServer({ name: 'maple-auction', version: '0.2.0' }, { instructions });

  let identity: (Identity & { characterName?: string }) | null = null;
  let characters: CharacterInfo[] | null = null;
  const bodyCache = new Map<string, ReturnType<typeof buildCreateBody>>();

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
  async function runSearch(params: SearchParams) {
    const id = await ensureIdentity();
    if (typeof id === 'string') return text(id);
    const body = buildCreateBody(params, id);
    const created = await bridge.request({ type: 'fetch', url: SEARCH_URL, method: 'POST', body });
    if (!created.ok) return text(errorText(created));
    const data = created.data as any;
    if (data?.searchKey) bodyCache.set(data.searchKey, body);
    return text({ ...summarizeSearch(data), searchRemaining: await searchRemaining() });
  }

  server.registerTool(
    'search_items',
    {
      title: '거래소 빠른 검색 (이름 위주)',
      description:
        '메이플스토리 거래소에서 아이템 이름으로 빠르게 검색한다. 가격 낮은순 10개(1페이지)와 searchKey를 반환하며, 더 많은 결과·다른 정렬·다음 페이지는 searchKey로 get_page를 호출한다(get_page는 검색 횟수를 소진하지 않음). 이 검색 자체는 일일 검색 횟수를 1회 소진한다. 잠재·에디셔널·추옵·가격 등 상세 필터가 필요하면 search_weapon / search_armor 를 사용하라.' + RESULT_NOTE,
      inputSchema: {
        keyword: z.string().describe('아이템 이름 검색어'),
        exactMatch: z.boolean().optional().describe('정확히 일치 (기본 false)'),
        category: z.string().optional().describe("카테고리 코드 (예: 'WEAPON')"),
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
        '무기를 상세 필터로 검색한다 (검색 횟수 1회 소진, 추가 페이지는 get_page). 잠재/에디셔널 옵션은 [{option, minValue}] 형식이고 기본은 합산 모드다. 예: 에디셔널 공격력 합 21% 이상 체인 → subCategory=WEAPON_ONE_HANDED_CHAIN, additionalPotentialOptions=[{option:"physicalAttackPercent", minValue:21}]' + RESULT_NOTE,
      inputSchema: {
        subCategory: enumOf(WEAPON_CATEGORY_KEYS)
          .default('WEAPON')
          .describe(`무기 분류. ${labelList(WEAPON_CATEGORY_LABELS)}`),
        ...detailFilterSchema,
      },
    },
    async ({ subCategory, ...rest }) => runSearch({ ...(rest as SearchParams), category: subCategory as string })
  );

  server.registerTool(
    'search_armor',
    {
      title: '방어구·장신구 상세 검색 (전체 필터)',
      description:
        '방어구/장신구를 상세 필터로 검색한다 (검색 횟수 1회 소진, 추가 페이지는 get_page). 잠재/에디셔널 옵션은 [{option, minValue}] 형식이고 기본은 합산 모드다.' + RESULT_NOTE,
      inputSchema: {
        subCategory: enumOf(ARMOR_CATEGORY_KEYS)
          .default('ARMOR')
          .describe(`방어구 분류. ${labelList(ARMOR_CATEGORY_LABELS)}`),
        ...detailFilterSchema,
        ...seedRingSchema,
      },
    },
    async ({ subCategory, ...rest }) => runSearch({ ...(rest as SearchParams), category: subCategory as string })
  );

  server.registerTool(
    'get_page',
    {
      title: '검색 결과 페이지 조회 (정렬/페이지네이션)',
      description:
        'search_items/search_weapon/search_armor 가 반환한 searchKey로 원하는 정렬·페이지·크기의 결과를 조회한다. GET만 사용하므로 일일 검색 횟수를 소진하지 않는다. 응답의 hasNext가 true면 page를 늘려 다음 페이지를 볼 수 있다. 키가 만료됐으면 같은 조건으로 자동 재검색(이때만 검색 1회 소진).' + RESULT_NOTE,
      inputSchema: {
        searchKey: z.string().describe('검색 응답의 searchKey'),
        page: z.number().int().min(1).default(1).describe('페이지 번호 (1부터)'),
        limit: z
          .union([z.literal(20), z.literal(40), z.literal(60)])
          .default(20)
          .describe('페이지 크기. 20 / 40 / 60만 허용'),
        sort: z
          .enum(SORTS)
          .default('PRICE_PER_ITEM_ASC')
          .describe(
            'ITEM_NAME_ASC(이름순) / PRICE_PER_ITEM_ASC(개당 낮은가격) / PRICE_DESC(높은가격) / ATTACK_POWER_DESC(전투력증가량 높은순 — 검색 결과 500개 이하일 때만 동작, 필터로 좁힌 뒤 사용) / END_DATE_ASC(판매종료 임박순, 급처 매물) / REGISTER_DATE_DESC(최신등록순, 스나이핑)'
          ),
      },
    },
    async ({ searchKey, page, limit, sort }) => {
      const id = await ensureIdentity();
      if (typeof id === 'string') return text(id);
      const q = { page, limit: limit as GetLimit, sort: sort as Sort };
      const reply = await bridge.request({ type: 'fetch', url: buildPageUrl(searchKey, q, id), method: 'GET' });
      if (reply.ok) return text(summarizeSearch(reply.data));

      // searchKey 만료 추정 → 캐시된 조건으로 재검색(POST) 후 해당 페이지 재조회
      if (reply.code === 'HTTP_ERROR' && reply.status !== 403) {
        const cached = bodyCache.get(searchKey);
        if (cached) {
          const recreated = await bridge.request({ type: 'fetch', url: SEARCH_URL, method: 'POST', body: cached });
          const newKey: string | undefined = recreated.ok ? (recreated.data as any)?.searchKey : undefined;
          if (newKey) {
            bodyCache.set(newKey, cached);
            const retry = await bridge.request({ type: 'fetch', url: buildPageUrl(newKey, q, id), method: 'GET' });
            if (retry.ok) return text(summarizeSearch(retry.data));
          }
        }
      }
      return text(errorText(reply));
    }
  );

  server.registerTool(
    'recent_sold',
    {
      title: '최근 시세 (판매 완료 매물)',
      description:
        '최근에 판매 완료된 매물(최근 시세)을 조회한다. 일일 검색 횟수를 소진하지 않는다. 현재 검색 기준 캐릭터의 월드(그룹) 기준이다.' + RESULT_NOTE,
      inputSchema: {},
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
    'list_characters',
    {
      title: '계정 캐릭터 목록',
      description:
        '넥슨 계정의 모든 메이플 캐릭터를 월드별로 조회한다 (검색 횟수 소진 없음). set_character로 검색 기준 캐릭터(=검색 대상 월드)를 바꿀 수 있다.',
      inputSchema: {},
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
        '검색에 사용할 캐릭터를 전환한다. 거래소는 월드(그룹) 단위이므로 다른 월드 캐릭터로 바꾸면 그 월드의 매물이 검색된다. 이름 또는 characterId로 지정한다 (검색 횟수 소진 없음). 전환 후 이전 searchKey는 이전 캐릭터 기준이므로 새로 검색하는 것이 안전하다.',
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
      description: '크롬 확장 연결, 넥슨 계정, 현재 검색 기준 캐릭터(월드 이름 포함), 일일 검색 잔여 횟수를 확인한다.',
      inputSchema: {},
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
