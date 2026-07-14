import type { UnionRaiderRes } from '../../nexon/index.js';
import type { StatBlock } from '../stat-interface.js';
import { parseEffectLines } from './template-parser.js';
import { UNION_STATE } from './unionState-db.js';

// 유니온 점령 효과(union_state_stat + union_occupied_stat) → StatBlock. 주스탯 %적용. 상시.
export function getUnionState(union: UnionRaiderRes): StatBlock {
  const lines = [
    ...(union.union_state_stat ?? []),
    ...(union.union_occupied_stat ?? []),
  ] as string[];
  return parseEffectLines(lines, UNION_STATE);
}
