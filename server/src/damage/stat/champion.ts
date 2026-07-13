import type { UnionChampionRes } from '../../nexon/index.js';
import type { StatBlock } from '../stat-interface.js';
import { CHAMPION } from './champion-db.js';
import { parseMapleTemplates } from './template-parser.js';

// 챔피언 뱃지 → StatBlock. 상시 패시브. 뱃지 문자열을 합쳐 한 번에 템플릿을 훑는다.
// (각 스탯은 total_info에 한 줄씩만 등장하므로 exec 단일 매칭으로 충분.)
export function getChampion(champion: UnionChampionRes): StatBlock {
  const joined = (champion.champion_badge_total_info ?? [])
    .map((badge) => badge.stat)
    .join('\n');

  const { block } = parseMapleTemplates(joined, CHAMPION);
  return block;
}
