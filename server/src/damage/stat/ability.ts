import type { AbilityRes } from '../../nexon/index.js';
import type { StatBlock } from '../stat-interface.js';
import { parseEffectLines } from './effect-lines-parser.js';

export function getAbility(ability: AbilityRes): StatBlock {
  return parseEffectLines(
    (ability.ability_info ?? []).map((line) => line.ability_value)
  );
}
