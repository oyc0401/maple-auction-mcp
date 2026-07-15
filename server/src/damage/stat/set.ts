import type { SetEffectRes } from '../../nexon/index.js';
import type { StatBlock } from '../stat-interface.js';
import { parseEffectLines } from './effect-lines-parser.js';

export function getSet(response: SetEffectRes): Record<string, StatBlock> {
  const result: Record<string, StatBlock> = {};

  for (const set of response.set_effect ?? []) {
    const block = parseEffectLines(
      (set.set_effect_info ?? []).map((effect) => effect.set_option)
    );
    if (Object.keys(block).length > 0) result[set.set_name] = block;
  }

  return result;
}
