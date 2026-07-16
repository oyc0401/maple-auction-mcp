import { describe, it, expect } from 'vitest';
import { buildCreateBody } from './mapping.js';

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

describe('buildCreateBody (상세 필터, 2026-07-08 웹 거래소 POST 실측 스키마)', () => {
  it('전체 필터를 실측 스키마 그대로 직렬화한다', () => {
    const body = buildCreateBody(
      {
        keyword: '아케',
        category: 'ARMOR_ARMOR',
        jobClass: 'THIEF',
        priceMin: 1000000,
        priceMax: 5000000000,
        levelMin: 100,
        levelMax: 250,
        starforceMin: 1,
        starforceMax: 22,
        potentialGrade: 3,
        additionalPotentialGrade: 2,
        potentialOptions: [{ option: 'physicalAttackPercent', minValue: 9 }],
        additionalPotentialOptions: [{ option: 'physicalAttackPercent', minValue: 21 }],
        extraOptions: [{ option: 'exMaxHp', minValue: 1 }],
        scrollOptions: [{ option: 'scrollPhysicalAttack', minValue: 1 }],
        remainUpgradeCountMin: 1,
        remainUpgradeCountMax: 9,
        seedRingLevelMin: 1,
        seedRingLevelMax: 4,
        cuttableCountMin: 0,
        cuttableCountMax: 10,
        myWorldOnly: true,
      },
      id
    ) as any;
    // 실제 웹 거래소가 보내는 POST 바디를 fetch 인터셉트로 캡처해 확인한 형태
    expect(body.filters).toEqual({
      keyword: '아케',
      exactMatch: false,
      itemCategory: { itemDetailCategory: 'ARMOR_ARMOR', itemJobCategory: 'THIEF' },
      price: { min: '1000000', max: '5000000000' },
      basicOption: { levelMin: 100, levelMax: 250 },
      enhancementOption: {
        starforceMin: 1,
        starforceMax: 22,
        potentialGrade: 3,
        additionalPotentialGrade: 2,
        potentialOptionSum: { physicalAttackPercent: 9 },
        additionalPotentialOptionSum: { physicalAttackPercent: 21 },
        exMaxHp: 1,
        scrollPhysicalAttack: 1,
        remainUpgradeCountMin: 1,
        remainUpgradeCountMax: 9,
      },
      etcOption: { seedRingLevelMin: 1, seedRingLevelMax: 4, cuttableCountMin: 0, cuttableCountMax: 10 },
      myWorldOnly: true,
    });
  });

  it('합산을 끄면 줄별 단일 키 객체 배열(potentialOptions)로 보낸다', () => {
    const body = buildCreateBody(
      {
        keyword: 'x',
        potentialOptions: [
          { option: 'physicalAttackPercent', minValue: 9 },
          { option: 'bossDamagePercent', minValue: 30 },
        ],
        potentialSum: false,
      },
      id
    ) as any;
    expect(body.filters.enhancementOption.potentialOptions).toEqual([
      { physicalAttackPercent: 9 },
      { bossDamagePercent: 30 },
    ]);
    expect(body.filters.enhancementOption.potentialOptionSum).toBeUndefined();
  });

  it('합산 모드에서 같은 키 여러 줄은 값을 더한다', () => {
    const body = buildCreateBody(
      {
        keyword: 'x',
        potentialOptions: [
          { option: 'physicalAttackPercent', minValue: 9 },
          { option: 'physicalAttackPercent', minValue: 12 },
        ],
      },
      id
    ) as any;
    expect(body.filters.enhancementOption.potentialOptionSum).toEqual({ physicalAttackPercent: 21 });
  });

  it('토글 4종은 true일 때만 etcOption에 넣는다', () => {
    const body = buildCreateBody(
      { keyword: 'x', uncuttable: true, isBindedWhenEquipped: true, isExOptExtractable: true, isPotentialExtractable: true },
      id
    ) as any;
    expect(body.filters.etcOption).toEqual({
      uncuttable: true,
      isBindedWhenEquipped: true,
      isExOptExtractable: true,
      isPotentialExtractable: true,
    });
    const none = buildCreateBody({ keyword: 'x', uncuttable: false }, id) as any;
    expect(none.filters.etcOption).toBeUndefined();
  });

  it('캐시 필터를 실측 스키마 그대로 직렬화한다 (2026-07-10 캡처: gender·royalSpecialType은 basicOption, 기간제는 cashOption)', () => {
    const body = buildCreateBody(
      {
        category: 'CASH',
        gender: 'MALE',
        royalSpecialType: 2,
        cashOptions: [{ option: 'periodStr', minValue: 11 }],
      },
      id
    ) as any;
    expect(body.filters).toEqual({
      exactMatch: false,
      itemCategory: { itemDetailCategory: 'CASH' },
      basicOption: { gender: 'MALE', royalSpecialType: 2 },
      cashOption: { periodStr: 11 },
    });
  });

  it('royalSpecialType 0(일반 라벨)과 petGrade 0(일반 펫)도 필터로 전달한다', () => {
    const body = buildCreateBody({ category: 'CASH_PET', petGrade: 0, royalSpecialType: 0 }, id) as any;
    expect(body.filters.basicOption).toEqual({ petGrade: 0, royalSpecialType: 0 });
  });

  it('키워드가 없으면 keyword 필드를 생략한다 (빈 문자열은 API가 400으로 거부)', () => {
    const body = buildCreateBody({ category: 'WEAPON_ONE_HANDED_CHAIN' }, id) as any;
    expect('keyword' in body.filters).toBe(false);
    expect(body.filters.itemCategory).toEqual({ itemDetailCategory: 'WEAPON_ONE_HANDED_CHAIN' });
  });
});
