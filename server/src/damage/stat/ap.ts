import type { CharacterStat } from '../../nexon/index.js';
import type { StatBlock } from '../stat-interface.js';

const AP_STAT_KEYS = {
  'AP 배분 STR': 'STR',
  'AP 배분 DEX': 'DEX',
  'AP 배분 INT': 'INT',
  'AP 배분 LUK': 'LUK',
  'AP 배분 HP': 'HP',
} as const satisfies Record<string, keyof StatBlock>;

export function getAP(stat: CharacterStat): StatBlock {
  const block: StatBlock = {};

  for (const line of stat.final_stat ?? []) {
    const key = AP_STAT_KEYS[line.stat_name as keyof typeof AP_STAT_KEYS];
    if (!key) continue;

    const value = Number(line.stat_value);
    if (!Number.isFinite(value) || value === 0) continue;

    const values = block as Record<string, number>;
    values[key] = (values[key] ?? 0) + value;
  }

  return block;
}
