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

// 장착 코어 3개(character_hexa_stat_core[_2/_3]). preset_* 는 미장착 프리셋 → 제외.
const ACTIVE = [
  'character_hexa_stat_core',
  'character_hexa_stat_core_2',
  'character_hexa_stat_core_3',
] as const;

// 코어 스탯 이름 → 열. 공/마는 이름으로 갈라 addCore에서 처리. '보스/크리티컬 데미지'가 바 '데미지' 선점.
function colOf(name: string | null): Col | null {
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
  const b = block as Record<string, number>;
  b[key] = (b[key] ?? 0) + value;
}

function addCore(
  block: StatBlock,
  name: string | null,
  level: number,
  isMain: boolean,
  job: JobStat | undefined
): void {
  const col = colOf(name);
  if (!col || !level) return;
  const i = level - 1;
  const tbl = isMain ? MAIN : SUB;

  if (col === 'main') {
    // 헥사 주력스탯은 스탯% 미적용(abs) → 미적용 버킷. 직업별 분기.
    if (job === 'xenon') {
      const v = (isMain ? MAIN_XENON : SUB_XENON)[i] ?? 0;
      for (const s of ['STR미적용', 'DEX미적용', 'INT미적용', 'LUK미적용'])
        addScalar(block, s, v);
    } else if (job === 'deven') {
      addScalar(block, 'HP미적용', (isMain ? MAIN_DEVEN : SUB_DEVEN)[i] ?? 0);
    } else if (job) {
      addScalar(block, `${job}미적용`, tbl.main[i] ?? 0); // job = 주스탯(STR/DEX/INT/LUK)
    }
    return;
  }

  const val = tbl[col][i] ?? 0;
  if (col === 'atk')
    addScalar(block, name?.includes('마력') ? '마력' : '공격력', val);
  else if (col === 'boss') addScalar(block, '보공', val);
  else if (col === 'damage') addScalar(block, '데미지', val);
  else if (col === 'critDmg') addScalar(block, '크뎀', val);
  else if (col === 'ied') {
    block.방무 = [...(block.방무 ?? []), val]; // 방무는 곱연산 배열
  }
}

// 6차 헥사 스탯 코어 → StatBlock. 직업은 응답의 character_class로 판정(JOB_STAT). 미등재 직업은 주력스탯만 스킵.
export function getHexaStat(hexa: HexaMatrixStatRes): StatBlock {
  const block: StatBlock = {};
  const job = JOB_STAT[hexa.character_class];
  for (const field of ACTIVE) {
    for (const c of hexa[field] ?? []) {
      addCore(block, c.main_stat_name, Number(c.main_stat_level), true, job);
      addCore(block, c.sub_stat_name_1, Number(c.sub_stat_level_1), false, job);
      addCore(block, c.sub_stat_name_2, Number(c.sub_stat_level_2), false, job);
    }
  }
  return block;
}
