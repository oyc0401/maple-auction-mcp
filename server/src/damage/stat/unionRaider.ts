import type { UnionRaiderRes } from '../../nexon/index.js';
import type { StatBlock } from '../stat-interface.js';
import { parseEffectLines } from './template-parser.js';
import { UNION_RAIDER } from './unionRaider-db.js';

// 유니온 공격대원 배치 효과(union_raider_stat) → StatBlock. 주스탯·올스탯·HP 미적용. 상시.
export function getUnionRaider(union: UnionRaiderRes): StatBlock {
  return parseEffectLines(union.union_raider_stat ?? [], UNION_RAIDER);
}
