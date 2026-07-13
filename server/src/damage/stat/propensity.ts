import type { PropensityRes } from '../../nexon/index.js';
import type { StatBlock } from '../stat-interface.js';

// 성향 → StatBlock. 카리스마만 방무(lv×0.1)로 상시 반영.
export function getPropensity(propensity: PropensityRes): StatBlock {
  const block: StatBlock = {};
  const charisma = Number(propensity.charisma_level ?? 0) || 0;
  if (charisma) block.방무 = [charisma * 0.1];
  return block;
}
