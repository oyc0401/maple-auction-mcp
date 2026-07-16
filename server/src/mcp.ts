import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SORTS, type SearchParams, type Sort, type GetLimit } from './auction/mapping.js';
import { loadKnowledge } from './knowledge.js';
import { AuctionService } from './auction/service.js';
import {
  POTENTIAL_OPTION_KEYS,
  EX_OPTION_KEYS,
  SCROLL_OPTION_KEYS,
  ARMOR_CATEGORY_KEYS,
  WEAPON_CATEGORY_KEYS,
  CONSUME_CATEGORY_KEYS,
  CASH_CATEGORY_KEYS,
  ETC_CATEGORY_KEYS,
  CASH_PERIOD_OPTION_KEYS,
  ROYAL_LABEL_GRADES,
  ROYAL_LABEL_KEYS,
  PET_GRADES,
  PET_GRADE_KEYS,
  JOB_CLASSES,
} from './auction/constants.js';

import { WISHLIST_MAX, type MapleAuctionApi } from './auction/api.js';
import type {
  LoadCharacterSnapshot,
  RefreshCharacterSnapshot,
} from './characterSnapshot.js';

function text(value: unknown) {
  return { content: [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value, null, 1) }] };
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
  sold: z.boolean().optional().describe('true면 같은 필터로 판매 완료 매물(최근 3개월 체결가 = 시세) 검색. 기본 false(판매 중 호가)'),
};

// 소비·캐시·기타(비장비)가 공유하는 단순 필터 — 웹 UI 실측: 하위 분류·가격뿐, 장비 필터 없음
const simpleFilterSchema = {
  keyword: detailFilterSchema.keyword,
  exactMatch: detailFilterSchema.exactMatch,
  priceMin: detailFilterSchema.priceMin,
  priceMax: detailFilterSchema.priceMax,
  myWorldOnly: detailFilterSchema.myWorldOnly,
  sold: detailFilterSchema.sold,
};

// 반지 전용이지만 방어구 스키마에 포함
const seedRingSchema = {
  seedRingLevelMin: z.number().int().optional().describe('특수 스킬 반지 레벨 최소 (반지 전용)'),
  seedRingLevelMax: z.number().int().optional().describe('특수 스킬 반지 레벨 최대 (반지 전용)'),
};

export function createServer(
  api: MapleAuctionApi,
  loadCharacterSnapshot: LoadCharacterSnapshot,
  refreshCharacterSnapshot: RefreshCharacterSnapshot = loadCharacterSnapshot
): McpServer {
  // 클라이언트가 시스템 프롬프트에 주입하는 도구 사용 규칙. 한국어 유지 — 응답·필터가 전부 한국어라 톤을 맞추고,
  // 방무·공퍼·보공 같은 단축어를 모델에 학습시키는 의미도 있음. (압축 유지)
  // 행동 규칙은 전부 여기에 둔다 — 도구 description에 행동 지시를 넣으면 디렉토리 심사에서 프롬프트 인젝션으로 간주됨.
  // 게임 도메인 지식은 여기가 아니라 maple://knowledge 리소스(지식 노트)로 서빙한다 — 상시 토큰을 아끼고 필요할 때만 로드.
  // 검색 전략 팁(노작·정렬·시세)은 지식 노트의 "경매장 검색 팁" 절(get_knowledge로 온디맨드 서빙)에 있다.
  // 여기엔 도구 사용의 최소 규칙만 — 상시 토큰이므로 짧게 유지.
  const instructions = [
    '메이플스토리(KMS) 거래소 검색 MCP.',
    '매물 추천·가치 판단·시세 해석·검색 전략 수립 전에 get_knowledge(같은 내용의 maple://knowledge 리소스)를 읽는다 — 게임 지식(추옵·잠재·가위·별칭·타월드)과 경매장 검색 팁이 있다. 읽지 않은 채 도메인 규칙을 임의 추론하지 말 것.',
    '- 첫 검색 전 get_status로 검색 기준 캐릭터(월드·닉네임)를 확인해 사용자에게 알린다. nexonOpenApi.configured=false면 응답의 setup대로 API 키 설정 방법도 안내한다. 월드 전환은 set_character.',
    '- 검색 생성(search_* 도구, sold 포함)만 일일 한도(100회)를 1회 소진 — 한도는 검색 품질을 깎을 만큼 빡빡하지 않다(잔여는 응답의 searchRemaining). 같은 조건 재조회만 재검색 대신 searchKey + get_page(무료). limit 40/60은 조건이 확정된 뒤에.',
    '- 검색 결과를 보여줄 때 사용한 필터 조건을 함께 표기한다.',
    '- 가위(재거래) 잔여 횟수가 낮은 매물은 사용자에게 꼭 명시한다(tradeDesc 참고).',
    '- 매물 id("ynoFBr…:1" 류)는 도구 호출용 내부 값 — 사용자에게 노출하지 말 것. 별칭은 표에 넣지 말고 문장에서 사용.',
    '- 지원되는 장비 검색 결과에는 현재 기준 캐릭터가 착용했을 때의 부위별 finalDamageChangeRate(최종 데미지 증감률 %)가 포함된다.',
  ].join('\n');

  const server = new McpServer({ name: 'maple-auction', version: '0.8.0' }, { instructions });

  const service = new AuctionService(
    api,
    loadCharacterSnapshot,
    refreshCharacterSnapshot
  );

  server.registerResource(
    'maple-knowledge',
    'maple://knowledge',
    {
      title: '메이플 지식 노트',
      description: '매물 추천·가치 판단 전에 반드시 읽을 게임 상식 (추옵·잠재·가위·별칭·타월드)',
      mimeType: 'text/markdown',
    },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'text/markdown', text: loadKnowledge() }] })
  );

  // 리소스를 못 읽는 호스트(Claude Desktop 등)를 위한 도구 버전 — context7의 문서 서빙 패턴.
  // get_knowledge
  server.registerTool(
    'get_knowledge',
    {
      title: '메이플 지식 노트',
      description: '메이플 게임 상식·매물 판단 기준(지식 노트) 전문 반환 — 추옵·잠재(이탈)·가위·별칭·타월드 등 매물 추천과 가치 판단의 근거.',
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async () => text(loadKnowledge())
  );

  // user_equip
  server.registerTool(
    'user_equip',
    {
      title: '캐릭터 착용 장비 조회',
      description:
        '닉네임으로 임의 캐릭터가 현재 착용 중인 장비를 조회한다(넥슨 오픈 API, 마지막 로그아웃 기준, 영구 로컬 캐시, 검색 횟수 무관). slot 생략 시 전 부위 요약 목록, 지정 시 스탯·잠재·에디·소울 상세.',
      inputSchema: {
        characterName: z.string().optional().describe('조회할 캐릭터 닉네임. 생략 시 현재 검색 기준 캐릭터'),
        slot: z.string().optional().describe('부위 (예: "무기", "반지1", "펜던트2"). 생략 시 전체 목록'),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ characterName, slot }) => text(await service.userEquip(characterName, slot))
  );

  // refresh_character
  server.registerTool(
    'refresh_character',
    {
      title: '캐릭터 정보 강제 재갱신',
      description:
        '지정한 캐릭터의 넥슨 OpenAPI 정보를 다시 조회해 영구 로컬 캐시를 최신 데이터로 교체한다. characterName 생략 시 현재 검색 기준 캐릭터를 갱신한다.',
      inputSchema: {
        characterName: z.string().optional().describe('재갱신할 캐릭터 닉네임. 생략 시 현재 검색 기준 캐릭터'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ characterName }) => text(await service.refreshCharacter(characterName))
  );

  // search_items
  server.registerTool(
    'search_items',
    {
      title: '거래소 빠른 검색 (이름 위주)',
      description:
        '아이템 이름으로 거래소 빠른 검색. 가격 낮은순 10개와 searchKey 반환, 추가 페이지·정렬은 get_page. 잠재·추옵·가격 등 상세 필터와 시세(판매 완료가)는 search_weapon/search_armor, 소비·캐시·기타 아이템은 search_consume/search_cash/search_etc.',
      inputSchema: {
        keyword: z.string().describe('아이템 이름 검색어'),
        exactMatch: z.boolean().optional().describe('정확히 일치 (기본 false)'),
        category: z.string().optional().describe("카테고리 코드. search_weapon/search_armor의 subCategory와 같은 체계 (예: 'WEAPON')"),
        potentialGrade: z.number().int().min(0).max(4).optional().describe(`잠재등급: ${gradeDesc}`),
        myWorldOnly: z.boolean().optional().describe('현재 캐릭터 월드의 매물만'),
      },
      // 일일 검색 횟수를 소진하지만 데이터 변경은 없다 → 읽기로 분류
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async (params) => text(await service.search(params as SearchParams))
  );

  // search_weapon
  server.registerTool(
    'search_weapon',
    {
      title: '무기 상세 검색 (전체 필터)',
      description:
        '무기 상세 필터 검색(판매 중 호가). sold=true면 같은 필터로 판매 완료 매물(최근 3개월 체결가 = 시세)을 검색한다. 잠재/에디셔널은 [{option, minValue}] 배열(기본 합산 모드). 예: 에디 공퍼 합 21%↑ 체인 → subCategory:"WEAPON_ONE_HANDED_CHAIN", additionalPotentialOptions:[{option:"physicalAttackPercent", minValue:21}].',
      inputSchema: {
        subCategory: enumOf(WEAPON_CATEGORY_KEYS)
          .default('WEAPON')
          .describe('무기 분류. 키=무기명(비자명: THROWING_GLOVE=아대, SCROLL=두루마리, DUAL_BOW=듀얼 보우건, CANE=케인). WEAPON_SUB=보조무기 전체'),
        ...detailFilterSchema,
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ subCategory, sold, ...rest }) => text(await service.search({ ...(rest as SearchParams), category: subCategory as string }, sold))
  );

  // search_armor
  server.registerTool(
    'search_armor',
    {
      title: '방어구·장신구 상세 검색 (전체 필터)',
      description:
        '방어구/장신구 상세 필터 검색(판매 중 호가). sold=true면 같은 필터로 판매 완료 매물(최근 3개월 체결가 = 시세)을 검색한다. 잠재/에디셔널은 [{option, minValue}] 배열(기본 합산 모드).',
      inputSchema: {
        subCategory: enumOf(ARMOR_CATEGORY_KEYS)
          .default('ARMOR')
          .describe('방어구·장신구 분류. 키=부위명(비자명: LONGCOAT=한벌옷, FACE/EYE=얼굴/눈장식, DRAGON_CAP=드래곤 장비, MACHINE_HEART=기계 심장)'),
        ...detailFilterSchema,
        ...seedRingSchema,
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ subCategory, sold, ...rest }) => text(await service.search({ ...(rest as SearchParams), category: subCategory as string }, sold))
  );

  // search_consume
  server.registerTool(
    'search_consume',
    {
      title: '소비 아이템 검색 (물약·주문서·환불 등)',
      description:
        '소비 아이템 검색(판매 중 호가) — 회복·비약, 각종 주문서, 환생의 불꽃, 스킬북, 레시피 등. sold=true면 같은 필터로 판매 완료 매물(최근 3개월 체결가 = 시세)을 검색한다. 필터는 하위 분류·가격뿐(장비 필터 없음). CONSUME 전체 검색은 결과 과다로 거부될 수 있어 하위 분류·키워드 지정이 안전.',
      inputSchema: {
        subCategory: enumOf(CONSUME_CATEGORY_KEYS)
          .default('CONSUME')
          .describe('소비 분류. 비자명: SCROLL_FLAME=환생의 불꽃, SCROLL_WHITE=백의/혼돈의 주문서, SCROLL_ENCHANT=장비 강화/잠재 주문서, ALCHEMY_ELIXER=비약, ETC_ARROW=화살/표창'),
        ...simpleFilterSchema,
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ subCategory, sold, ...rest }) => text(await service.search({ ...(rest as SearchParams), category: subCategory as string }, sold))
  );

  // search_cash
  server.registerTool(
    'search_cash',
    {
      title: '캐시 아이템 검색 (큐브·코디·펫 등)',
      description:
        '캐시 아이템 검색(판매 중 호가) — 큐브·강화, 코디(성별·라벨 등급 필터), 뷰티(헤어·성형), 펫(펫 등급 필터), 게임 편의. sold=true면 같은 필터로 판매 완료 매물(시세)을 검색한다. 기간제 캐시템은 periodOptions로 스탯 최소값 필터 가능. CASH 전체 검색은 결과 과다로 거부될 수 있다.',
      inputSchema: {
        subCategory: enumOf(CASH_CATEGORY_KEYS)
          .default('CASH')
          .describe('캐시 분류. ENCHANT_CUBE=큐브, COORDINATION_*=코디(외형), BEAUTY_COSMETIC=성형, PET_PET=펫'),
        ...simpleFilterSchema,
        gender: z.enum(['남', '여']).optional().describe('착용 성별 (코디·뷰티 전용)'),
        itemGrade: enumOf(ROYAL_LABEL_KEYS).optional().describe('코디 라벨 등급 (코디 전용)'),
        petGrade: enumOf(PET_GRADE_KEYS).optional().describe('펫 등급 (펫 전용)'),
        periodOptions: optionRows(CASH_PERIOD_OPTION_KEYS, '기간제', 'period+스탯명 (기간제 캐시템의 부여 스탯)'),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ subCategory, sold, gender, itemGrade, petGrade, periodOptions, ...rest }) =>
      text(
        await service.search(
          {
            ...(rest as SearchParams),
            category: subCategory as string,
            gender: gender === '남' ? 'MALE' : gender === '여' ? 'FEMALE' : undefined,
            royalSpecialType: itemGrade != null ? ROYAL_LABEL_GRADES[itemGrade] : undefined,
            petGrade: petGrade != null ? PET_GRADES[petGrade] : undefined,
            cashOptions: periodOptions,
          },
          sold
        )
      )
  );

  // search_etc
  server.registerTool(
    'search_etc',
    {
      title: '기타 아이템 검색 (의자·재료 등)',
      description:
        '기타 아이템 검색(판매 중 호가) — 의자, 전문기술 아이템, 재료류(주문의 정수 등은 ETC 전체에서). sold=true면 같은 필터로 판매 완료 매물(시세)을 검색한다. 필터는 하위 분류·가격뿐.',
      inputSchema: {
        subCategory: enumOf(ETC_CATEGORY_KEYS).default('ETC').describe('기타 분류'),
        ...simpleFilterSchema,
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ subCategory, sold, ...rest }) => text(await service.search({ ...(rest as SearchParams), category: subCategory as string }, sold))
  );

  // get_page
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
            '정렬. PRICE_PER_ITEM_ASC=개당 낮은가격, PRICE_DESC=가격 높은순, ATTACK_POWER_DESC=전투력증가 높은순(보공·방무 미반영, 결과 500개 이하일 때만 동작), END_DATE_ASC=종료 임박(급처), REGISTER_DATE_DESC=최신등록(스나이핑)'
          ),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ searchKey, page, limit, sort }) => text(await service.getPage(searchKey, page, limit as GetLimit, sort as Sort))
  );

  // recent_sold
  server.registerTool(
    'recent_sold',
    {
      title: '최근 시세 (판매 완료 매물)',
      description:
        '최근 판매 완료 매물(시세) 조회. 현재 검색 기준 캐릭터의 월드 기준. 특정 아이템·조건의 시세는 search_weapon/search_armor에 sold=true.',
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async () => text(await service.recentSold())
  );

  // get_wishlist
  server.registerTool(
    'get_wishlist',
    {
      title: '찜 목록 조회',
      description:
        `찜 목록과 남은 슬롯 조회 (최대 ${WISHLIST_MAX}개).`,
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async () => text(await service.getWishlist())
  );

  // add_wishlist
  server.registerTool(
    'add_wishlist',
    {
      title: '찜 목록에 추가',
      description:
        `매물을 찜 목록에 추가 (최대 ${WISHLIST_MAX}개, remainingSlots 반환). 중복이면 409, 다른 월드 그룹이면 실패.`,
      inputSchema: {
        itemId: z.string().describe('매물 id (검색 결과의 id 필드, "TRADESN:SUBIDX" 형식)'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ itemId }) => text(await service.addWishlist(itemId))
  );

  // remove_wishlist
  server.registerTool(
    'remove_wishlist',
    {
      title: '찜 목록에서 제거',
      description:
        '매물을 찜 목록에서 제거 (remainingSlots 반환).',
      inputSchema: {
        itemId: z.string().describe('매물 id (검색 결과 또는 get_wishlist의 id 필드)'),
      },
      // 찜 해제는 같은 id로 즉시 재추가 가능(데이터 손실 없음) → 파괴적 아님
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ itemId }) => text(await service.removeWishlist(itemId))
  );

  // list_characters
  server.registerTool(
    'list_characters',
    {
      title: '계정 캐릭터 목록',
      description:
        '넥슨 계정의 캐릭터를 월드별로 조회. 검색 기준 월드 전환은 set_character.',
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async () => text(await service.listCharacters())
  );

  // set_character
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
      // 서버 내부 검색 기준만 바꾼다(넥슨 데이터 변경 없음) — 읽기는 아니지만 파괴적이지 않고 재실행 안전
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ characterName, characterId }) => text(await service.setCharacter(characterName, characterId))
  );

  // get_status
  server.registerTool(
    'get_status',
    {
      title: '연결 상태 확인',
      description:
        '크롬 확장 연결·넥슨 계정·현재 검색 기준 캐릭터(월드)·넥슨 OpenAPI 키 설정 여부·일일 검색 잔여 횟수 확인. API 키가 없으면 nexonOpenApi.setup에 발급 및 실행 인자 설정법을 반환한다. state: no_extension(확장 미연결) / no_session(거래소 세션 없음) / session_expired(세션 만료·회전) / ready.',
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async () => text(await service.status())
  );

  return server;
}
