import { describe, expect, it } from 'vitest';
import type { CashItemEquipmentRes } from '../../nexon/index.js';
import { getCash } from './cash.js';

function cashRes(options: Array<[string, string]>): CashItemEquipmentRes {
  return {
    cash_item_equipment_base: [
      {
        cash_item_option: options.map(([option_type, option_value]) => ({
          option_type,
          option_value,
        })),
      },
    ],
  } as unknown as CashItemEquipmentRes;
}

describe('캐시장비 → StatBlock', () => {
  it('주스탯·올스탯·공마만 수집하고 방어력·이속·HP는 무시한다', () => {
    const cash = cashRes([
      ['STR', '30'],
      ['LUK', '35'],
      ['공격력', '15'],
      ['마력', '15'],
      ['방어력', '300'],
      ['이동속도', '50'],
      ['최대 HP', '1750'],
    ]);
    expect(getCash(cash)).toEqual({ STR: 30, LUK: 35, 공격력: 15, 마력: 15 });
  });
});
