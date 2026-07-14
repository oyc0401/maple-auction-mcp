import type { UnionRaiderRes } from '../../nexon/index.js';
import type { StatBlock } from '../stat-interface.js';
import { parseEffectLines } from './effect-lines-parser.js';

export function getUnionState(union: UnionRaiderRes): StatBlock {
  const lines = [
    ...(union.union_state_stat ?? []),
    ...(union.union_occupied_stat ?? []).filter(
      (line): line is string => typeof line === 'string'
    ),
  ];
  return parseEffectLines(lines);
}
