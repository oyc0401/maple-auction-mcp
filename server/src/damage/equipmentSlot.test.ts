import { describe, expect, it } from 'vitest';
import { getEquipmentSlot } from './equipmentSlot.js';

describe('getEquipmentSlot', () => {
  it('Nexon 슬롯명을 GearStats 슬롯명으로 변환한다', () => {
    expect(getEquipmentSlot('모자')).toBe('모자');
    expect(getEquipmentSlot('포켓 아이템')).toBe('포켓아이템');
    expect(getEquipmentSlot('기계 심장')).toBe('기계심장');
  });

  it('지원하지 않는 슬롯은 null을 반환한다', () => {
    expect(getEquipmentSlot('예비 특수 반지')).toBeNull();
  });
});
