import { getEquipmentSlot, type EquipmentSlot } from './equipmentSlot.js';

interface AuctionRawItem {
  toolTip?: { categories?: string[] | null };
}

// 한 매물이 여러 슬롯 후보를 갖는 부위. categories는 "반지"까지만 알려주고
// 그게 반지 몇 번 칸인지는 매물 자신도 모른다 → 후보를 모두 넘겨 호출부가 비교한다.
const MULTI_SLOTS: Partial<Record<string, EquipmentSlot[]>> = {
  반지: ['반지1', '반지2', '반지3', '반지4'],
  펜던트: ['펜던트', '펜던트2'],
};

// 매물이 어느 부위인지는 오직 아이템 JSON으로 판단한다 — 검색 필터를 보면
// 이름만으로 검색(search_items)했을 때나 상위 카테고리(WEAPON) 검색에서 슬롯을 잃는다.
//
// 실측(2026-07-16) toolTip.categories 예:
//   무기     ["무기","한손","체인"]        보조무기 ["보조무기","블레이드"]
//   방패     ["보조무기","방패"]           망토     ["방어구","망토"]
//   어깨장식 ["어깨장식"]                  반지     ["장신구","반지"]
// 대분류("방어구"·"장신구")와 중분류("한손")는 슬롯명이 아니라 그냥 안 걸린다.
export function getAuctionEquipmentSlots(item: AuctionRawItem): EquipmentSlot[] | null {
  for (const name of item.toolTip?.categories ?? []) {
    const multi = MULTI_SLOTS[name];
    if (multi) return [...multi];
    const slot = getEquipmentSlot(name);
    if (slot) return [slot];
  }
  return null;
}
