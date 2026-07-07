import { API_BASE, type Identity } from '@maple/shared';

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

export interface SearchParams {
  keyword: string;
  exactMatch?: boolean;
  category?: string; // 검증된 값: 'WEAPON'
  potentialGrade?: number; // 0없음 1레어 2에픽 3유니크 4레전드리
}

export const SEARCH_URL = `${API_BASE}/searches/tool-tip`;
// 검색 잔여 횟수 등: {search:{limit,remaining}, register:{limit,remaining}}
export const DAILY_LIMIT_URL = API_BASE.replace(/\/items$/, '/daily-limit');

// POST: 검색 세션 생성 (필터 저장 + searchKey 발급). 정렬·페이지 선택 없이 가격낮은순 10개 고정.
export function buildCreateBody(p: SearchParams, id: Identity) {
  const filters: Record<string, unknown> = {
    keyword: p.keyword,
    exactMatch: p.exactMatch ?? false,
  };
  if (p.category) filters.itemCategory = { itemDetailCategory: p.category };
  if (p.potentialGrade != null) filters.enhancementOption = { potentialGrade: p.potentialGrade };
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

// GET: 발급된 searchKey로 페이지 조회. 정렬·페이지·크기(20/40/60)를 여기서 지정한다.
export function buildPageUrl(
  searchKey: string,
  q: { page: number; limit: GetLimit; sort: Sort },
  id: Identity
): string {
  const qs = new URLSearchParams({
    accountId: String(id.accountId),
    characterId: String(id.characterId),
    page: String(q.page),
    limit: String(q.limit),
    sortType: q.sort,
  });
  return `${API_BASE}/searches/${encodeURIComponent(searchKey)}/tool-tip?${qs}`;
}
