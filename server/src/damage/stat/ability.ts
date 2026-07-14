import type { AbilityRes } from '../../nexon/index.js';
import type { StatBlock } from '../stat-interface.js';
import { ABILITY } from './ability-db.js';
import { parseEffectLines } from './template-parser.js';

// 어빌리티 → StatBlock. ability_info(최상위)가 활성 프리셋. 상시.
export function getAbility(ability: AbilityRes): StatBlock {
  const lines = (ability.ability_info ?? []).map((a) => a.ability_value);
  return parseEffectLines(lines, ABILITY);
}
