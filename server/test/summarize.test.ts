import { describe, it, expect } from 'vitest';
import { summarizeSearch, summarizeItem } from '../src/summarize.js';

// 실측 응답(2026-07-08 검증)을 축약한 픽스처 — 키 이름은 실제와 동일
const item = {
  _id: 'wL5nlhSYA:1',
  itemName: '아케인셰이드 가즈',
  quantity: 1,
  price: '349999999',
  pricePerItem: '349999999',
  starforce: 22,
  currentUpgradeCount: 6,
  attackPowerDiff: 12500,
  wishlistCount: 3,
  endDate: '2026-07-09T12:24:11.920Z',
  status: 'ON_SALE',
  toolTip: {
    reqLevel: 200,
    stat: { str: 30, dex: 100, luk: 163, all: 6, pad: 284, mad: 0, mhp: 1200, pdd: 400, mmp: 500, dam: 5, bdr: 30, imdr: 20 },
    tradeDesc: ['1회 교환 가능 (거래 후 교환 불가)', '(가위 사용 잔여 횟수 : 7 / 10)'],
    exceptionalUpgrade: { entries: [{ text: 'STR +30' }, { text: '공격력 +15' }], description: '익셉셔널 강화' },
    soulWeapon: { status: 'ENCHANTED', soulName: '위대한 데미안의 소울', optionText: '공격력 +15', skillName: '소울 스플릿' },
    upgradeInfo: {
      scroll: { current: 6, remaining: 2, failure: 1, max: 9, canUpgrade: true, description: '주문서 강화 6회 (잔여 2회, 복구 가능 1회)' },
      exOption: { sum: 23, entries: [{ grade: 6, text: '올스탯 +6%' }, { grade: 6, text: '공격력 +72' }] },
      potential: {
        grade: 4,
        entries: [
          { grade: 4, text: '공격력 +12%' },
          { grade: 4, text: '몬스터 방어율 무시 +40%' },
        ],
        description: '잠재능력 : 레전드리',
      },
      additionalPotential: { grade: 0, entries: [], description: '에디셔널 잠재능력 : 없음' },
    },
  },
};

const resp = {
  items: [item],
  page: 1,
  limit: 20,
  total: 682,
  totalPages: 35,
  hasNext: true,
  searchKey: '2b9718f8-649c-4210-a0e1-ec4f7ac58653',
};

describe('summarizeItem', () => {
  it('핵심 필드만 뽑고 가격은 개당가격(price)으로 변환한다', () => {
    const s = summarizeItem(item);
    expect(s).toEqual({
      id: 'wL5nlhSYA:1',
      name: '아케인셰이드 가즈',
      price: 349999999,
      quantity: 1,
      starforce: 22,
      scroll: '강화 6회 (남은 횟수 2 / 복구가능 1 / 총 9)',
      powerDiff: 12500,
      // 한 줄 스탯 문자열(user_equip과 동일 라벨). 0은 생략, 방어력(pdd)·MP(mmp)는 제외.
      stat: 'STR+30 DEX+100 LUK+163 올스탯%+6 HP+1200 공격력+284 보공%+30 뎀%+5 방무%+20',
      exOption: '올스탯 +6% / 공격력 +72',
      potential: '레전드리: 공격력 +12% / 몬스터 방어율 무시 +40%',
      // additional: 등급 없음 → 필드 생략
      exceptional: 'STR +30 / 공격력 +15',
      soul: '위대한 데미안의 소울 / 공격력 +15',
      tradeDesc: '1회 교환 가능 (거래 후 교환 불가) · (가위: 7 / 10)',
      status: 'ON_SALE',
      endDate: '2026-07-09T12:24:11.920Z',
      wishlist: 3,
      isMyWorld: true,
    });
  });

  it('값 없는 필드는 생략한다 (깡통 매물) — status·quantity·isMyWorld는 유지', () => {
    const s = summarizeItem({ _id: 'x', itemName: 'y', pricePerItem: '1', quantity: 1, starforce: 0, wishlistCount: 0, endDate: 'd', status: 'ON_SALE' }) as any;
    expect(s.price).toBe(1);
    for (const k of ['scroll', 'powerDiff', 'stat', 'exOption', 'potential', 'additional', 'exceptional', 'soul', 'tradeDesc', 'tradeDate', 'isAmazingHyperUpgradeUsed', 'finalStat']) {
      expect(s, `${k}는 값이 없으면 생략`).not.toHaveProperty(k);
    }
    // 시세(SOLD 구분)·기타/소비템(수량·개당가) 판단에 필요한 필드는 값이 뻔해도 유지
    expect(s.status).toBe('ON_SALE');
    expect(s.quantity).toBe(1);
    expect(s.isMyWorld).toBe(true);
  });

  it('값이 있으면 유지한다 — tradeDate(시세), powerDiff 0, 놀장 true', () => {
    const s = summarizeItem({
      ...item,
      status: 'SOLD',
      tradeDate: '2026-07-01T00:00:00.000Z',
      attackPowerDiff: 0,
      toolTip: { ...item.toolTip, isAmazingHyperUpgradeUsed: true },
    }) as any;
    expect(s.status).toBe('SOLD');
    expect(s.tradeDate).toBe('2026-07-01T00:00:00.000Z');
    expect(s.powerDiff).toBe(0); // 0은 유효한 값(현재 장비와 동급)
    expect(s.isAmazingHyperUpgradeUsed).toBe(true);
  });

  it('isMyWorld를 그대로 전달한다 (필드 없으면 true)', () => {
    expect(summarizeItem({ ...item, isMyWorld: false }).isMyWorld).toBe(false);
    expect(summarizeItem({ ...item, isMyWorld: true }).isMyWorld).toBe(true);
    expect(summarizeItem(item).isMyWorld).toBe(true);
  });

  it('소울 미장착이면 soul을 생략한다', () => {
    const s = summarizeItem({ ...item, toolTip: { ...item.toolTip, soulWeapon: { status: 'NOT_ENCHANTED', soulName: null, optionText: null, skillName: null } } });
    expect(s).not.toHaveProperty('soul');
  });

  it('스탯이 전부 0이면 stat을 생략한다', () => {
    const s = summarizeItem({ ...item, toolTip: { stat: { str: 0, pad: 0, pdd: 400 } } });
    expect(s).not.toHaveProperty('stat');
  });
});

describe('summarizeSearch', () => {
  it('페이지네이션 메타 + 요약 아이템 배열을 반환한다', () => {
    const s = summarizeSearch(resp);
    expect(s.total).toBe(682);
    expect(s.totalPages).toBe(35);
    expect(s.hasNext).toBe(true);
    expect(s.searchKey).toBe('2b9718f8-649c-4210-a0e1-ec4f7ac58653');
    expect(s.items).toHaveLength(1);
    expect(s.items[0].name).toBe('아케인셰이드 가즈');
  });
});
