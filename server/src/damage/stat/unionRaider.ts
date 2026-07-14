import type { UnionRaiderRes } from '../../nexon/index.js';
import type { StatBlock } from '../stat-interface.js';
import { parseEffectLines } from './effect-lines-parser.js';

export function getUnionRaider(union: UnionRaiderRes): StatBlock {
  const {
    STR,
    DEX,
    INT,
    LUK,
    올스탯,
    HP,
    ...block
  } = parseEffectLines(union.union_raider_stat ?? []);

  return {
    ...block,
    ...(STR !== undefined && { STR미적용: STR }),
    ...(DEX !== undefined && { DEX미적용: DEX }),
    ...(INT !== undefined && { INT미적용: INT }),
    ...(LUK !== undefined && { LUK미적용: LUK }),
    ...(올스탯 !== undefined && { 올스탯미적용: 올스탯 }),
    ...(HP !== undefined && { HP미적용: HP }),
  };
}
