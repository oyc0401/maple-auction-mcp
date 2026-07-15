import type { ItemEquipmentRes } from '../nexon/index.js';
import { type EquipmentSlot, getEquipmentSlot } from './equipmentSlot.js';
import { SET_DB } from './setDb.js';
import {
  calculateSetEffects,
  countEquipmentSets,
  normalizeSetName,
} from './setSimulation.js';
import type { CharacterStats, StatBlock } from './stat-interface.js';

export interface CharacterEquipmentState {
  stats: CharacterStats;
  equipment: ItemEquipmentRes;
}

export interface EquipmentReplacement {
  slot: EquipmentSlot;
  name: string;
  stats: StatBlock;
}

function unsupportedCurrentEffects(
  effects: CharacterStats['세트효과']
): Record<string, StatBlock> {
  return Object.fromEntries(
    Object.entries(effects ?? {}).filter(
      ([setName]) => !SET_DB[normalizeSetName(setName)]
    )
  );
}

export function getStatsAfterEquipmentReplacement(
  current: CharacterEquipmentState,
  replacement: EquipmentReplacement
): CharacterStats {
  const itemIndex = current.equipment.item_equipment.findIndex(
    (item) => getEquipmentSlot(item.item_equipment_slot) === replacement.slot
  );
  if (itemIndex < 0) {
    throw new Error(`교체할 장비 슬롯을 찾을 수 없습니다: ${replacement.slot}`);
  }

  const itemNames = current.equipment.item_equipment.map((item, index) =>
    index === itemIndex ? replacement.name : item.item_name
  );
  const counts = countEquipmentSets(itemNames);

  return {
    ...current.stats,
    장비: {
      ...current.stats.장비,
      [replacement.slot]: replacement.stats,
    },
    세트효과: {
      ...unsupportedCurrentEffects(current.stats.세트효과),
      ...calculateSetEffects(counts),
    },
  };
}
