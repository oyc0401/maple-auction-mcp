import { describe, expect, it } from 'vitest';
import { getAuctionEquipmentSlots } from './auctionEquipmentSlot.js';

describe('getAuctionEquipmentSlots', () => {
  it('무기와 보조무기 카테고리를 실제 CharacterStats 슬롯으로 변환한다', () => {
    expect(getAuctionEquipmentSlots('WEAPON_ONE_HANDED_CHAIN')).toEqual([
      '무기',
    ]);
    expect(getAuctionEquipmentSlots('WEAPON_SUB')).toEqual(['보조무기']);
    expect(getAuctionEquipmentSlots('ARMOR_ARMOR_SHIELD')).toEqual([
      '보조무기',
    ]);
  });

  it('반지는 네 슬롯, 펜던트는 두 슬롯을 모두 반환한다', () => {
    expect(getAuctionEquipmentSlots('ARMOR_ACCESSORY_RING')).toEqual([
      '반지1',
      '반지2',
      '반지3',
      '반지4',
    ]);
    expect(getAuctionEquipmentSlots('ARMOR_ACCESSORY_PENDANT')).toEqual([
      '펜던트',
      '펜던트2',
    ]);
  });

  it('단일 부위 방어구는 대응하는 슬롯 하나만 반환한다', () => {
    expect(getAuctionEquipmentSlots('ARMOR_ARMOR_CAP')).toEqual(['모자']);
    expect(getAuctionEquipmentSlots('ARMOR_ARMOR_GLOVE')).toEqual(['장갑']);
    expect(getAuctionEquipmentSlots('ARMOR_ACCESSORY_EMBLEM')).toEqual([
      '엠블렘',
    ]);
    expect(getAuctionEquipmentSlots('ARMOR_ETC_MACHINE_HEART')).toEqual([
      '기계심장',
    ]);
  });

  it('부위가 특정되지 않은 상위 카테고리와 비장비는 추측하지 않는다', () => {
    expect(getAuctionEquipmentSlots('ARMOR')).toBeNull();
    expect(getAuctionEquipmentSlots('CONSUME')).toBeNull();
    expect(getAuctionEquipmentSlots('CASH')).toBeNull();
    expect(getAuctionEquipmentSlots(undefined)).toBeNull();
  });
});
