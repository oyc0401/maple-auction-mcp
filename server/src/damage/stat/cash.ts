import type { CashItemEquipmentRes } from '../../nexon/index.js';
import type { CashGearStats, StatBlock } from '../stat-interface.js';

const num = (v: unknown): number => Number(v ?? 0) || 0;

// cash_item_option.option_type → StatBlock 키. 주스탯·올스탯·공/마만 딜에 유효.
// 방어력·이속·점프·최대HP/MP는 여기 없음 → 미수집. 캐시 스탯은 주스탯% 적용 대상(미적용 아님).
type CashStat = 'STR' | 'DEX' | 'INT' | 'LUK' | '올스탯' | '공격력' | '마력';
const OPTION_KEY: Record<string, CashStat> = {
  STR: 'STR',
  DEX: 'DEX',
  INT: 'INT',
  LUK: 'LUK',
  올스탯: '올스탯',
  공격력: '공격력',
  마력: '마력',
};

// 캐시장비 → 슬롯별 장비. 교체 계산에서 기존 캐시 옵션을 정확히 뺄 수 있도록 합산하지 않는다.
export function getCash(cash: CashItemEquipmentRes): CashGearStats {
  const gear: CashGearStats = {};
  for (const item of cash.cash_item_equipment_base ?? []) {
    const block: StatBlock = {};
    for (const option of item.cash_item_option ?? []) {
      const key = OPTION_KEY[option.option_type];
      if (!key) continue;
      const value = num(option.option_value);
      if (value) block[key] = (block[key] ?? 0) + value;
    }
    if (item.cash_item_equipment_slot) {
      gear[item.cash_item_equipment_slot] = {
        name: item.cash_item_name,
        stat: block,
      };
    }
  }
  return gear;
}
