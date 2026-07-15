import type { EquipmentSlot } from './equipmentSlot.js';
import { SET_DB } from './setDb.js';
import {
  calculateSetEffects,
  countEquipmentSets,
  normalizeSetName,
} from './setSimulation.js';
import type { CharacterStats, StatBlock } from './stat-interface.js';

export interface EquipmentReplacement {
  slot: EquipmentSlot;
  name: string;
  stat: StatBlock;
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
  current: CharacterStats,
  replacement: EquipmentReplacement
): CharacterStats {
  if (!current.장비?.[replacement.slot]) {
    throw new Error(`교체할 장비 슬롯을 찾을 수 없습니다: ${replacement.slot}`);
  }

  const 장비 = {
    ...current.장비,
    [replacement.slot]: {
      name: replacement.name,
      stat: replacement.stat,
    },
  };
  const itemNames = Object.values(장비).map((item) => item.name);
  const counts = countEquipmentSets(itemNames);

  return {
    ...current,
    장비,
    세트효과: {
      ...unsupportedCurrentEffects(current.세트효과),
      ...calculateSetEffects(counts),
    },
  };
}
