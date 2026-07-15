import { JOB_STAT, type MainStat } from './stat/job.js';
import type { CharacterStats, StatBlock } from './stat-interface.js';

export interface CharacterDamageContext {
  job: string;
  level: number;
  stats: CharacterStats;
}

interface AggregatedStats {
  flat: Record<MainStat, number>;
  flatNoPercent: Record<MainStat, number>;
  percent: Record<MainStat, number>;
  allStat: number;
  allStatPercent: number;
  attack: number;
  magic: number;
  attackPercent: number;
  magicPercent: number;
  damage: number;
  bossDamage: number;
  statusDamage: number;
  ignoreDefense: number[];
  finalDamage: number[];
  criticalRate: number;
  criticalDamage: number;
  hp: number;
  hpNoPercent: number;
  hpPercent: number;
}

const MAIN_STATS: MainStat[] = ['STR', 'DEX', 'INT', 'LUK'];
const SUB_STAT: Record<MainStat, MainStat> = {
  STR: 'DEX',
  DEX: 'STR',
  INT: 'LUK',
  LUK: 'DEX',
};
const DOUBLE_SUB_STAT_JOBS = new Set(['카데나', '듀얼블레이드', '섀도어']);
const BOSS_DEFENSE_RATE = 3.8;

const STAT_KEYS = new Set<keyof StatBlock>([
  'STR',
  'DEX',
  'INT',
  'LUK',
  'STR미적용',
  'DEX미적용',
  'INT미적용',
  'LUK미적용',
  'STR퍼',
  'DEX퍼',
  'INT퍼',
  'LUK퍼',
  '올스탯',
  '올스탯미적용',
  '올스탯퍼',
  '레벨당STR',
  '레벨당DEX',
  '레벨당INT',
  '레벨당LUK',
  '공격력',
  '마력',
  '공격력퍼',
  '마력퍼',
  '데미지',
  '보공',
  '추가뎀',
  '방무',
  '최종뎀',
  '크확',
  '크뎀',
  'HP',
  'HP미적용',
  'HP퍼',
  '쿨감',
]);

function emptyAggregatedStats(): AggregatedStats {
  return {
    flat: { STR: 0, DEX: 0, INT: 0, LUK: 0 },
    flatNoPercent: { STR: 0, DEX: 0, INT: 0, LUK: 0 },
    percent: { STR: 0, DEX: 0, INT: 0, LUK: 0 },
    allStat: 0,
    allStatPercent: 0,
    attack: 0,
    magic: 0,
    attackPercent: 0,
    magicPercent: 0,
    damage: 0,
    bossDamage: 0,
    statusDamage: 0,
    ignoreDefense: [],
    finalDamage: [],
    criticalRate: 0,
    criticalDamage: 0,
    hp: 0,
    hpNoPercent: 0,
    hpPercent: 0,
  };
}

function number(block: StatBlock, key: keyof StatBlock): number {
  const value = block[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function addBlock(
  target: AggregatedStats,
  block: StatBlock,
  level: number
): void {
  for (const stat of MAIN_STATS) {
    target.flat[stat] += number(block, stat);
    target.flat[stat] += Math.floor(level / 9) * number(block, `레벨당${stat}`);
    target.flatNoPercent[stat] += number(block, `${stat}미적용`);
    target.flatNoPercent[stat] += number(block, '올스탯미적용');
    target.percent[stat] += number(block, `${stat}퍼`);
  }

  target.allStat += number(block, '올스탯');
  target.allStatPercent += number(block, '올스탯퍼');
  target.attack += number(block, '공격력');
  target.magic += number(block, '마력');
  target.attackPercent += number(block, '공격력퍼');
  target.magicPercent += number(block, '마력퍼');
  target.damage += number(block, '데미지');
  target.bossDamage += number(block, '보공');
  target.statusDamage += number(block, '추가뎀');
  target.criticalRate += number(block, '크확');
  target.criticalDamage += number(block, '크뎀');
  target.hp += number(block, 'HP');
  target.hpNoPercent += number(block, 'HP미적용');
  target.hpPercent += number(block, 'HP퍼');
  target.ignoreDefense.push(...(block.방무 ?? []));
  target.finalDamage.push(...(block.최종뎀 ?? []));
}

function isStatBlock(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value);
  return (
    keys.length > 0 &&
    keys.every((key) => STAT_KEYS.has(key as keyof StatBlock))
  );
}

function collectBlocks(
  value: unknown,
  target: AggregatedStats,
  level: number
): void {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return;

  const record = value as Record<string, unknown>;
  if (isStatBlock(record)) {
    addBlock(target, record as StatBlock, level);
    return;
  }

  for (const child of Object.values(record)) {
    collectBlocks(child, target, level);
  }
}

function aggregateStats(stats: CharacterStats, level: number): AggregatedStats {
  const result = emptyAggregatedStats();
  collectBlocks(stats, result, level);

  const mapleWarrior = stats.메이플용사 ?? 0;
  if (mapleWarrior !== 0) {
    for (const stat of MAIN_STATS) {
      result.flat[stat] += Math.floor(
        ((stats.AP[stat] ?? 0) * mapleWarrior) / 100
      );
    }
  }

  return result;
}

function finalStat(stats: AggregatedStats, stat: MainStat): number {
  return (
    Math.floor(
      (stats.flat[stat] + stats.allStat) *
        (1 + (stats.percent[stat] + stats.allStatPercent) / 100)
    ) + stats.flatNoPercent[stat]
  );
}

function finalHp(stats: AggregatedStats): number {
  return Math.floor(stats.hp * (1 + stats.hpPercent / 100)) + stats.hpNoPercent;
}

function statFactor(job: string, stats: AggregatedStats): number {
  const jobStat = JOB_STAT[job];
  if (!jobStat) throw new Error(`지원하지 않는 직업: ${job}`);

  if (jobStat === 'deven') {
    return 4 * Math.floor(finalHp(stats) / 3.5) + finalStat(stats, 'STR');
  }
  if (jobStat === 'xenon') {
    return (
      4 *
      (finalStat(stats, 'STR') +
        finalStat(stats, 'DEX') +
        finalStat(stats, 'LUK'))
    );
  }

  const secondary = SUB_STAT[jobStat];
  const secondSecondary = DOUBLE_SUB_STAT_JOBS.has(job) ? 'STR' : null;
  return (
    4 * finalStat(stats, jobStat) +
    finalStat(stats, secondary) +
    (secondSecondary ? finalStat(stats, secondSecondary) : 0)
  );
}

function damageOf(
  context: CharacterDamageContext,
  stats: CharacterStats
): number {
  const aggregated = aggregateStats(stats, context.level);
  const jobStat = JOB_STAT[context.job];
  if (!jobStat) throw new Error(`지원하지 않는 직업: ${context.job}`);

  const useMagic = jobStat === 'INT';
  const attack = Math.floor(
    (useMagic ? aggregated.magic : aggregated.attack) *
      (1 +
        (useMagic ? aggregated.magicPercent : aggregated.attackPercent) / 100)
  );
  const damageFactor =
    1 +
    (aggregated.damage + aggregated.bossDamage + aggregated.statusDamage) / 100;
  const criticalDamage =
    aggregated.criticalDamage +
    (aggregated.criticalRate * (stats.크리티컬리인포스 ?? 0)) / 100;
  const criticalFactor = 1 + criticalDamage / 100;
  const ignoreDefenseRemain = aggregated.ignoreDefense.reduce(
    (remain, value) => remain * (1 - value / 100),
    1
  );
  const defenseFactor = Math.max(
    0,
    1 - BOSS_DEFENSE_RATE * ignoreDefenseRemain
  );
  const finalDamageFactor = aggregated.finalDamage.reduce(
    (factor, value) => factor * (1 + value / 100),
    1
  );

  return (
    statFactor(context.job, aggregated) *
    attack *
    damageFactor *
    criticalFactor *
    defenseFactor *
    finalDamageFactor
  );
}

function roundRate(value: number): number {
  return Math.round(value * 100) / 100 || 0;
}

export function getFinalDamageChangeRate(
  character: CharacterDamageContext,
  changedStats: CharacterStats
): number {
  const before = damageOf(character, character.stats);
  if (!Number.isFinite(before) || before <= 0) {
    throw new Error('변경 전 데미지가 0 이하라 증감률을 계산할 수 없습니다.');
  }

  const after = damageOf(character, changedStats);
  if (!Number.isFinite(after) || after < 0) {
    throw new Error('변경 후 데미지를 계산할 수 없습니다.');
  }

  return roundRate((after / before - 1) * 100);
}
