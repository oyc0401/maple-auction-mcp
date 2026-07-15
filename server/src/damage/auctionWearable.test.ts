import { describe, expect, it } from 'vitest';
import { isAuctionItemWearable } from './auctionWearable.js';

// reqJob·unwearableJobNames 값은 실측(2026-07-16 아케인셰이드 스태프 매물 응답)이다.
describe('isAuctionItemWearable', () => {
  it('직업군이 다르면 못 입는다', () => {
    const staff = { toolTip: { reqJob: '마법사', unwearableJobNames: ['키네시스', '일리움', '라라', '레테'] } };
    expect(isAuctionItemWearable(staff, '카데나')).toBe(false);
    expect(isAuctionItemWearable(staff, '비숍')).toBe(true);
  });

  it('직업군이 같아도 예외 직업이면 못 입는다', () => {
    const staff = { toolTip: { reqJob: '마법사', unwearableJobNames: ['키네시스', '일리움', '라라', '레테'] } };
    expect(isAuctionItemWearable(staff, '일리움')).toBe(false);
  });

  it('reqJob이 없으면 직업 제한이 없는 장비다', () => {
    expect(isAuctionItemWearable({ toolTip: { reqJob: null, unwearableJobNames: [] } }, '카데나')).toBe(true);
    expect(isAuctionItemWearable({ toolTip: {} }, '카데나')).toBe(true);
    expect(isAuctionItemWearable({}, '카데나')).toBe(true);
  });

  it('직업군을 모르는 직업이면 착용 가능하다고 우기지 않는다', () => {
    expect(isAuctionItemWearable({ toolTip: { reqJob: '마법사' } }, '없는직업')).toBe(false);
  });
});
