import { describe, expect, it } from 'vitest';
import { getAuctionEquipmentSlots } from './auctionEquipmentSlot.js';

// categories 값은 실측(2026-07-16, 크로아 거래소 응답)에서 그대로 가져왔다.
// 슬롯 판단은 검색 필터를 보지 않는다 — 이름만으로 검색해도(search_items) 동작해야 하기 때문.
describe('getAuctionEquipmentSlots', () => {
  it('무기는 categories 첫 칸이 슬롯이다', () => {
    expect(getAuctionEquipmentSlots({
      toolTip: { categories: ['무기', '한손', '체인'] },
    })).toEqual(['무기']);
  });

  it('보조무기도 categories 첫 칸이 슬롯이다', () => {
    expect(getAuctionEquipmentSlots({
      toolTip: { categories: ['보조무기', '블레이드'] },
    })).toEqual(['보조무기']);
  });

  it('방패는 경매장 분류가 방어구라도 매물 categories가 보조무기로 말한다', () => {
    expect(getAuctionEquipmentSlots({
      toolTip: { categories: ['보조무기', '방패'] },
    })).toEqual(['보조무기']);
  });

  it('방어구는 대분류를 건너뛰고 뒤칸 부위명을 슬롯으로 쓴다', () => {
    expect(getAuctionEquipmentSlots({
      toolTip: { categories: ['방어구', '망토'] },
    })).toEqual(['망토']);
    expect(getAuctionEquipmentSlots({
      toolTip: { categories: ['방어구', '한벌옷'] },
    })).toEqual(['한벌옷']);
  });

  it('대분류 없이 부위명만 오는 장신구도 처리한다', () => {
    expect(getAuctionEquipmentSlots({
      toolTip: { categories: ['어깨장식'] },
    })).toEqual(['어깨장식']);
  });

  it('반지는 몇 번 칸인지 매물이 모르므로 후보 슬롯을 모두 준다', () => {
    expect(getAuctionEquipmentSlots({
      toolTip: { categories: ['장신구', '반지'] },
    })).toEqual(['반지1', '반지2', '반지3', '반지4']);
  });

  // 실측(2026-07-16 크로아 펜던트 검색): categories에 "펜던트"가 들어있음을 확인했다.
  // 대분류 접두사가 붙는지는 확인 못 했다 — 반지는 ["장신구","반지"]인데 어깨장식은 ["어깨장식"]이라
  // 유추가 안 되고, 대분류는 어차피 슬롯으로 안 걸리니 두 모양 다 같은 답이어야 한다.
  it('펜던트는 대분류가 붙든 안 붙든 두 슬롯 모두 후보다', () => {
    expect(getAuctionEquipmentSlots({
      toolTip: { categories: ['장신구', '펜던트'] },
    })).toEqual(['펜던트', '펜던트2']);
    expect(getAuctionEquipmentSlots({
      toolTip: { categories: ['펜던트'] },
    })).toEqual(['펜던트', '펜던트2']);
  });

  it('장비가 아니면 슬롯을 추측하지 않는다', () => {
    expect(getAuctionEquipmentSlots({ toolTip: { categories: ['소비', '주문서'] } })).toBeNull();
    expect(getAuctionEquipmentSlots({ toolTip: {} })).toBeNull();
    expect(getAuctionEquipmentSlots({})).toBeNull();
  });
});
