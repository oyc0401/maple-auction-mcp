import type { HexaMatrixStatRes } from '../../nexon/index.js';
import type { StatBlock } from '../stat-interface.js';
import {
  type Col,
  MAIN,
  MAIN_DEVEN,
  MAIN_XENON,
  SUB,
  SUB_DEVEN,
  SUB_XENON,
} from './hexaStat-db.js';
import { JOB_STAT, type JobStat } from './job.js';

const ACTIVE_CORE_FIELDS = [
  'character_hexa_stat_core',
  'character_hexa_stat_core_2',
  'character_hexa_stat_core_3',
] as const;

function getColumn(name: string | null): Col | null {
  if (!name) return null;
  if (name.includes('주력 스탯')) return 'main';
  if (name.includes('크리티컬 데미지')) return 'critDmg';
  if (name.includes('보스 데미지')) return 'boss';
  if (name.includes('방어율 무시')) return 'ied';
  if (name.includes('공격력') || name.includes('마력')) return 'atk';
  if (name.includes('데미지')) return 'damage';
  return null;
}

function addScalar(block: StatBlock, key: string, value: number): void {
  const values = block as Record<string, number>;
  values[key] = (values[key] ?? 0) + value;
}

function addCoreStat(
  block: StatBlock,
  name: string | null,
  level: number,
  isMain: boolean,
  job: JobStat | undefined
): void {
  const column = getColumn(name);
  if (!column || !level) return;

  const index = level - 1;
  const table = isMain ? MAIN : SUB;

  if (column === 'main') {
    if (job === 'xenon') {
      const value = (isMain ? MAIN_XENON : SUB_XENON)[index] ?? 0;
      for (const stat of [
        'STR미적용',
        'DEX미적용',
        'INT미적용',
        'LUK미적용',
      ]) {
        addScalar(block, stat, value);
      }
    } else if (job === 'deven') {
      const value = (isMain ? MAIN_DEVEN : SUB_DEVEN)[index] ?? 0;
      addScalar(block, 'HP미적용', value);
    } else if (job) {
      addScalar(block, `${job}미적용`, table.main[index] ?? 0);
    }
    return;
  }

  const value = table[column][index] ?? 0;
  if (column === 'atk') {
    addScalar(block, name?.includes('마력') ? '마력' : '공격력', value);
  } else if (column === 'boss') {
    addScalar(block, '보공', value);
  } else if (column === 'damage') {
    addScalar(block, '데미지', value);
  } else if (column === 'critDmg') {
    addScalar(block, '크뎀', value);
  } else if (column === 'ied') {
    block.방무 = [...(block.방무 ?? []), value];
  }
}

export function getHexaStat(hexa: HexaMatrixStatRes): StatBlock {
  const block: StatBlock = {};
  const job = JOB_STAT[hexa.character_class];

  for (const field of ACTIVE_CORE_FIELDS) {
    for (const core of hexa[field] ?? []) {
      addCoreStat(
        block,
        core.main_stat_name,
        Number(core.main_stat_level),
        true,
        job
      );
      addCoreStat(
        block,
        core.sub_stat_name_1,
        Number(core.sub_stat_level_1),
        false,
        job
      );
      addCoreStat(
        block,
        core.sub_stat_name_2,
        Number(core.sub_stat_level_2),
        false,
        job
      );
    }
  }

  return block;
}
