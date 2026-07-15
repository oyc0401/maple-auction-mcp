import type { EquipmentSlot } from './equipmentSlot.js';

const CATEGORY_SLOTS: Partial<Record<string, EquipmentSlot[]>> = {
  WEAPON_SUB: ['보조무기'],
  ARMOR_ARMOR_CAP: ['모자'],
  ARMOR_ARMOR_COAT: ['상의'],
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
  ARMOR_ACCESSORY_POCKET: ['포켓아이템'],
  ARMOR_ETC_MACHINE_HEART: ['기계심장'],
};

export function getAuctionEquipmentSlots(
  category: string | undefined
): EquipmentSlot[] | null {
  if (!category) return null;
  const slots = CATEGORY_SLOTS[category];
  if (slots) return [...slots];
  if (category.startsWith('WEAPON_')) return ['무기'];
  return null;
}
