// 경매장 검색 subCategory → 넥슨 item_equipment_slot 이름 (Δ환산 비교 기준 부위).
// 무기·보조는 단일 슬롯. 다부위(반지 4·펜던트 2)는 여러 슬롯 → 교체 시 가장 이득인 부위 기준으로 비교.

const ARMOR_SLOTS: Record<string, string[]> = {
  ARMOR_ARMOR_CAP: ['모자'],
  ARMOR_ARMOR_COAT: ['상의'],
  ARMOR_ARMOR_LONGCOAT: ['한벌옷'],
  ARMOR_ARMOR_PANTS: ['하의'],
  ARMOR_ARMOR_SHOES: ['신발'],
  ARMOR_ARMOR_GLOVE: ['장갑'],
  ARMOR_ARMOR_CAPE: ['망토'],
  ARMOR_ARMOR_SHIELD: ['보조무기'],
  ARMOR_ACCESSORY_FACE: ['얼굴장식'],
  ARMOR_ACCESSORY_EYE: ['눈장식'],
  ARMOR_ACCESSORY_EAR: ['귀고리'],
  ARMOR_ACCESSORY_RING: ['반지1', '반지2', '반지3', '반지4'],
  ARMOR_ACCESSORY_PENDANT: ['펜던트', '펜던트2'],
  ARMOR_ACCESSORY_BELT: ['벨트'],
  ARMOR_ACCESSORY_SHOULDER: ['어깨장식'],
  ARMOR_ACCESSORY_EMBLEM: ['엠블렘'],
  ARMOR_ACCESSORY_MEDAL: ['훈장'],
  ARMOR_ACCESSORY_BADGE: ['뱃지'],
  ARMOR_ACCESSORY_POCKET: ['포켓 아이템'],
};

// 표시용 부위명. 넥슨은 펜던트 첫 슬롯을 "펜던트"로 주는데 "몇번째"가 분명하도록 1-based로 명시.
// (반지는 이미 반지1~4, 펜던트2는 그대로.)
export function slotLabel(slot: string): string {
  return slot === '펜던트' ? '펜던트1' : slot;
}

// slotLabel 역변환. 입력으로 "펜던트1"을 받으면 넥슨 실제 슬롯키 "펜던트"로 되돌린다.
export function slotFromLabel(label: string): string {
  return label === '펜던트1' ? '펜던트' : label;
}

// 환산 비교 대상 부위를 반환. 대상이 아니면(장비 아님, 상위 카테고리 등) null.
export function categoryToSlots(category?: string): string[] | null {
  if (!category) return null;
  if (category === 'WEAPON_SUB') return ['보조무기'];
  if (category.startsWith('WEAPON')) return ['무기'];
  return ARMOR_SLOTS[category] ?? null;
}
