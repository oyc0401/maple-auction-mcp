import { describe, expect, it } from 'vitest';
import type { CashItemEquipmentRes } from '../../nexon/index.js';
import { getCash } from './cash.js';

describe('캐시장비 → 슬롯별 장비', () => {
  it('주스탯·올스탯·공마만 수집하고 방어력·이속·HP는 무시한다', () => {
    expect(getCash({
      cash_item_equipment_base: [
        {
          cash_item_equipment_slot: '모자',
          cash_item_name: '테스트 캐시 모자',
          cash_item_option: [
            { option_type: 'STR', option_value: '30' },
            { option_type: 'LUK', option_value: '35' },
            { option_type: '공격력', option_value: '15' },
            { option_type: '마력', option_value: '15' },
            { option_type: '방어력', option_value: '300' },
            { option_type: '이동속도', option_value: '50' },
            { option_type: '최대 HP', option_value: '1750' },
          ],
        },
      ],
    } as unknown as CashItemEquipmentRes)).toEqual({
      모자: {
        name: '테스트 캐시 모자',
        stat: { STR: 30, LUK: 35, 공격력: 15, 마력: 15 },
      },
    });
  });
});
