import { describe, it, expect } from 'vitest';
import { buildCreateBody, buildPageUrl, SEARCH_URL } from '../src/mapping.js';

const id = { worldId: 5, accountId: 99188397, characterId: 25631906 };

describe('buildCreateBody (POST 세션 생성)', () => {
  it('정렬·페이지 선택 없이 가격낮은순 10개 고정 body를 만든다', () => {
    expect(buildCreateBody({ keyword: '아케인셰이드 가즈', category: 'WEAPON', potentialGrade: 4 }, id)).toEqual({
      worldId: 5,
      accountId: 99188397,
      characterId: 25631906,
      page: 1,
      limit: 10,
      sortType: 'PRICE_PER_ITEM_ASC',
      saveRecentKeyword: false,
      filters: {
        keyword: '아케인셰이드 가즈',
        exactMatch: false,
        itemCategory: { itemDetailCategory: 'WEAPON' },
        enhancementOption: { potentialGrade: 4 },
      },
    });
  });

  it('생략 가능한 필터는 아예 넣지 않는다', () => {
    const body = buildCreateBody({ keyword: 'x' }, id) as any;
    expect(body.filters).toEqual({ keyword: 'x', exactMatch: false });
    expect(body.filters.itemCategory).toBeUndefined();
  });

  it('potentialGrade 0(없음)도 필터로 전달한다', () => {
    const body = buildCreateBody({ keyword: 'x', potentialGrade: 0 }, id) as any;
    expect(body.filters.enhancementOption).toEqual({ potentialGrade: 0 });
  });
});

describe('buildPageUrl (GET 페이지 조회)', () => {
  it('정렬·페이지·크기를 반영한 GET URL을 만든다', () => {
    const url = buildPageUrl('a6dc000e-5f05-45d2-94e9-e3227d9569a9', { page: 2, limit: 40, sort: 'ATTACK_POWER_DESC' }, id);
    expect(url).toBe(
      'https://api.mskr.nexon.com/v1/market/web/items/searches/a6dc000e-5f05-45d2-94e9-e3227d9569a9/tool-tip?accountId=99188397&characterId=25631906&page=2&limit=40&sortType=ATTACK_POWER_DESC'
    );
  });

  it('searchKey를 URL 이스케이프해 경로 조작을 막는다', () => {
    const url = buildPageUrl('../../evil?x', { page: 1, limit: 20, sort: 'PRICE_PER_ITEM_ASC' }, id);
    expect(url).toContain('/searches/..%2F..%2Fevil%3Fx/tool-tip');
  });
});

describe('SEARCH_URL', () => {
  it('POST 엔드포인트', () => {
    expect(SEARCH_URL).toBe('https://api.mskr.nexon.com/v1/market/web/items/searches/tool-tip');
  });
});
