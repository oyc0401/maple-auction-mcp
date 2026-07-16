import type { Identity } from './api.js';

// 정렬값 (실측 2026-07-08, 전부 GET에서 동작 확인).
export const SORTS = [
  'ITEM_NAME_ASC', // 이름 가나다순
  'PRICE_PER_ITEM_ASC', // 개당 가격 낮은 순 (기본)
  'PRICE_DESC', // 가격 높은 순
  'ATTACK_POWER_DESC', // 전투력 증가량 높은 순
  'END_DATE_ASC', // 판매 종료 빠른 순
  'REGISTER_DATE_DESC', // 최신 등록 순
] as const;
export type Sort = (typeof SORTS)[number];

// POST(세션 생성)에 쓰는 기본 정렬. 실제 정렬은 GET에서 지정한다.
// (POST는 ATTACK_POWER_DESC 등 일부 정렬을 거부하므로 안전한 기본값 고정)
export const DEFAULT_SORT: Sort = 'PRICE_PER_ITEM_ASC';

// POST(세션 생성) 시 고정 반환 개수. 더 보려면 GET(get_page)을 쓴다.
export const CREATE_LIMIT = 10;

// GET(페이지 조회)에서 허용하는 페이지 크기. 그 외 값은 MCP단에서 막는다. (실측: 넥슨 UI 20/40/60)
export const GET_LIMITS = [20, 40, 60] as const;
export type GetLimit = (typeof GET_LIMITS)[number];

// 옵션 필터 한 줄: 옵션 키 + 최소값 (웹 UI의 "옵션 선택 + 최소값"과 동일)
export interface OptionRow {
  option: string;
  minValue: number;
}

// 필터 전체 (2026-07-08 웹 거래소 POST 바디 실측 기반)
export interface SearchParams {
  keyword?: string;
  exactMatch?: boolean;
  category?: string; // itemDetailCategory 코드 (WEAPON, ARMOR_ARMOR_CAP 등)
  jobClass?: string; // WARRIOR | MAGE | ARCHER | THIEF | PIRATE
  priceMin?: number;
  priceMax?: number;
  levelMin?: number;
  levelMax?: number;
  starforceMin?: number;
  starforceMax?: number;
  potentialGrade?: number; // 0없음 1레어 2에픽 3유니크 4레전드리
  additionalPotentialGrade?: number; // 동일 코드
  potentialOptions?: OptionRow[]; // 잠재능력 옵션 필터
  potentialSum?: boolean; // true(기본): 여러 줄 합산 / false: 줄별 개별 충족
  additionalPotentialOptions?: OptionRow[]; // 에디셔널 잠재 옵션 필터
  additionalPotentialSum?: boolean;
  extraOptions?: OptionRow[]; // 추가 옵션 (ex* 키)
  scrollOptions?: OptionRow[]; // 주문서 강화 누적치 (scroll* 키)
  remainUpgradeCountMin?: number; // 주문서 강화 잔여 횟수
  remainUpgradeCountMax?: number;
  seedRingLevelMin?: number; // 특수 스킬 반지 레벨
  seedRingLevelMax?: number;
  cuttableCountMin?: number; // 가위 사용 가능 횟수
  cuttableCountMax?: number;
  uncuttable?: boolean; // 가위 사용 횟수 미부여 (cuttableCount와 동시 사용 불가)
  isBindedWhenEquipped?: boolean; // 장착 시 교환 불가
  isExOptExtractable?: boolean; // 추가 옵션 추출 가능
  isPotentialExtractable?: boolean; // 잠재능력 추출 가능
  myWorldOnly?: boolean; // 현재 월드 아이템만
  // ── 캐시 전용 (실측 2026-07-10: basicOption/cashOption 캡처) ──
  gender?: 'MALE' | 'FEMALE'; // 착용 성별 (코디·뷰티·캐시 전체)
  royalSpecialType?: number; // 코디 라벨 등급: 0일반 1레드 2블랙 3스페셜 4마스터
  petGrade?: number; // 펫 등급: 0일반 1원더블랙 4루나스윗 5루나드림 6루나쁘띠
  cashOptions?: OptionRow[]; // 기간제 옵션 (period* 키), filters.cashOption 평면 객체로 직렬화
}

// 옵션 줄들 → 합산 모드: 한 객체에 키별 합산 { physicalAttackPercent: 21 }
// (같은 키 여러 줄이면 값을 더한다: UI에서 9+12 두 줄 = 합산 21과 동일)
function sumRows(rows: OptionRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.option] = (out[r.option] ?? 0) + r.minValue;
  return out;
}

// 옵션 줄들 → 개별 모드: 줄마다 단일 키 객체 배열 [{ physicalAttackPercent: 9 }, ...]
function eachRows(rows: OptionRow[]): Record<string, number>[] {
  return rows.map((r) => ({ [r.option]: r.minValue }));
}

// POST: 검색 세션 생성 (필터 저장 + searchKey 발급). 정렬·페이지 선택 없이 가격낮은순 10개 고정.
export function buildCreateBody(p: SearchParams, id: Identity) {
  // 실측: keyword는 빈 문자열이면 400(검증 오류). 없으면 필드 자체를 생략해야 한다.
  const filters: Record<string, unknown> = {
    exactMatch: p.exactMatch ?? false,
  };
  if (p.keyword) filters.keyword = p.keyword;

  if (p.category || p.jobClass) {
    const cat: Record<string, string> = {};
    if (p.category) cat.itemDetailCategory = p.category;
    if (p.jobClass) cat.itemJobCategory = p.jobClass;
    filters.itemCategory = cat;
  }

  // 실측: price.min/max는 문자열
  if (p.priceMin != null || p.priceMax != null) {
    const price: Record<string, string> = {};
    if (p.priceMin != null) price.min = String(p.priceMin);
    if (p.priceMax != null) price.max = String(p.priceMax);
    filters.price = price;
  }

  // 캐시 전용 필터(gender·라벨·펫 등급)도 basicOption 아래로 들어간다 (실측)
  if (p.levelMin != null || p.levelMax != null || p.gender != null || p.royalSpecialType != null || p.petGrade != null) {
    const basic: Record<string, number | string> = {};
    if (p.levelMin != null) basic.levelMin = p.levelMin;
    if (p.levelMax != null) basic.levelMax = p.levelMax;
    if (p.gender != null) basic.gender = p.gender;
    if (p.royalSpecialType != null) basic.royalSpecialType = p.royalSpecialType;
    if (p.petGrade != null) basic.petGrade = p.petGrade;
    filters.basicOption = basic;
  }

  const enh: Record<string, unknown> = {};
  if (p.starforceMin != null) enh.starforceMin = p.starforceMin;
  if (p.starforceMax != null) enh.starforceMax = p.starforceMax;
  if (p.potentialGrade != null) enh.potentialGrade = p.potentialGrade;
  if (p.additionalPotentialGrade != null) enh.additionalPotentialGrade = p.additionalPotentialGrade;
  if (p.potentialOptions?.length) {
    if (p.potentialSum ?? true) enh.potentialOptionSum = sumRows(p.potentialOptions);
    else enh.potentialOptions = eachRows(p.potentialOptions);
  }
  if (p.additionalPotentialOptions?.length) {
    if (p.additionalPotentialSum ?? true) enh.additionalPotentialOptionSum = sumRows(p.additionalPotentialOptions);
    else enh.additionalPotentialOptions = eachRows(p.additionalPotentialOptions);
  }
  // 추가옵션·주문서 강화는 enhancementOption 바로 아래 키로 들어간다 (실측: exMaxHp: 1, scrollPhysicalAttack: 1)
  for (const r of p.extraOptions ?? []) enh[r.option] = r.minValue;
  for (const r of p.scrollOptions ?? []) enh[r.option] = r.minValue;
  if (p.remainUpgradeCountMin != null) enh.remainUpgradeCountMin = p.remainUpgradeCountMin;
  if (p.remainUpgradeCountMax != null) enh.remainUpgradeCountMax = p.remainUpgradeCountMax;
  if (Object.keys(enh).length) filters.enhancementOption = enh;

  const etc: Record<string, unknown> = {};
  if (p.seedRingLevelMin != null) etc.seedRingLevelMin = p.seedRingLevelMin;
  if (p.seedRingLevelMax != null) etc.seedRingLevelMax = p.seedRingLevelMax;
  if (p.cuttableCountMin != null) etc.cuttableCountMin = p.cuttableCountMin;
  if (p.cuttableCountMax != null) etc.cuttableCountMax = p.cuttableCountMax;
  if (p.uncuttable) etc.uncuttable = true;
  if (p.isBindedWhenEquipped) etc.isBindedWhenEquipped = true;
  if (p.isExOptExtractable) etc.isExOptExtractable = true;
  if (p.isPotentialExtractable) etc.isPotentialExtractable = true;
  if (Object.keys(etc).length) filters.etcOption = etc;

  // 기간제 옵션: filters.cashOption 바로 아래 평면 키 (실측: { periodStr: 11 }). 같은 키 중복은 합산.
  if (p.cashOptions?.length) filters.cashOption = sumRows(p.cashOptions);

  if (p.myWorldOnly) filters.myWorldOnly = true;

  return {
    worldId: id.worldId,
    accountId: id.accountId,
    characterId: id.characterId,
    page: 1,
    limit: CREATE_LIMIT,
    sortType: DEFAULT_SORT,
    saveRecentKeyword: false,
    filters,
  };
}

// 매물 id "TRADESN:SUBIDX" → {tradeSn, subIdx}. subIdx는 마지막 콜론 뒤(tradeSn엔 콜론 없음).
export function parseItemId(itemId: string): { tradeSn: string; subIdx: number } {
  const i = itemId.lastIndexOf(':');
  if (i < 0) return { tradeSn: itemId, subIdx: 0 };
  return { tradeSn: itemId.slice(0, i), subIdx: Number(itemId.slice(i + 1)) || 0 };
}
