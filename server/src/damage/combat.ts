import type { UserStat, MainStat } from './statSheet.js';
import type { CharacterCollected } from './nexon.js';

const DOUBLE_SUB = new Set(['카데나', '듀얼블레이드', '섀도어']);
const SUB_OF: Record<MainStat, MainStat> = { STR: 'DEX', DEX: 'STR', INT: 'LUK', LUK: 'DEX' };

export type StatAxes =
  | { kind: 'standard'; main: MainStat; sub: MainStat; ssub: MainStat | null; isMagic: boolean }
  | { kind: 'da' }
  | { kind: 'xenon' };

export function statAxesOf(myClass: string, finalMain: Record<string, number>): StatAxes {
  if (myClass === '데몬어벤져') return { kind: 'da' };
  if (myClass === '제논') return { kind: 'xenon' };
  const cand: [MainStat, number][] = [
    ['STR', finalMain['STR'] ?? 0], ['DEX', finalMain['DEX'] ?? 0],
    ['INT', finalMain['INT'] ?? 0], ['LUK', finalMain['LUK'] ?? 0],
  ];
  cand.sort((a, b) => b[1] - a[1]);
  const main = cand[0][0];
  if (DOUBLE_SUB.has(myClass)) return { kind: 'standard', main, sub: 'DEX', ssub: 'STR', isMagic: false };
  return { kind: 'standard', main, sub: SUB_OF[main], ssub: null, isMagic: main === 'INT' };
}

export interface CombatStats {
  myClass: string;
  level: number;
  axes: StatAxes;
  us: UserStat;
  critRateTotal: number;
  critReinforcePct: number;
  notes: string[];
}

export function buildCombatStats(collected: CharacterCollected): CombatStats {
  const us = collected.userStat;
  const myClass = collected.final.characterClass;
  const axes = statAxesOf(myClass, collected.final.finalMain);
  const critReinforcePct = collected.stats.크리티컬리인포스 ?? 0;

  const notes: string[] = [];
  if (axes.kind !== 'standard') notes.push('제논·데몬어벤져 축은 미검증 — 증감률 참고용');

  return { myClass, level: collected.final.level, axes, us, critRateTotal: us.critRate, critReinforcePct, notes };
}

const statFinal = (us: UserStat, k: MainStat) =>
  Math.floor((us.flat[k] + us.allFlat) * (1 + (us.pct[k] + us.allPct) / 100)) + us.flatNoPct[k];
const hpFinal = (us: UserStat) => Math.floor(us.hpFlat * (1 + us.hpPct / 100)) + us.hpFlatNoPct;

function statFactor(cs: CombatStats, us: UserStat): number {
  const ax = cs.axes;
  if (ax.kind === 'da') return 4 * Math.floor(hpFinal(us) / 3.5) + statFinal(us, 'STR');
  if (ax.kind === 'xenon') return 4 * (statFinal(us, 'STR') + statFinal(us, 'DEX') + statFinal(us, 'LUK'));
  return 4 * statFinal(us, ax.main) + statFinal(us, ax.sub) + (ax.ssub ? statFinal(us, ax.ssub) : 0);
}

export interface DamageOpts {
  bossDef: number;
  critRateDelta?: number;
}

export function damageOf(cs: CombatStats, opts: DamageOpts, usOverride?: UserStat): number {
  const us = usOverride ?? cs.us;
  const isMagic = cs.axes.kind === 'standard' && cs.axes.isMagic;
  const atk = Math.floor((isMagic ? us.matk : us.atk) * (1 + (isMagic ? us.matkPct : us.atkPct) / 100));
  const dmgFactor = 1 + (us.damage + us.bossDmg + us.statusDmg) / 100;
  const critRate = cs.critRateTotal + (opts.critRateDelta ?? 0);
  const critDmg = us.critDmg + (critRate * cs.critReinforcePct) / 100;
  const critFactor = 1 + critDmg / 100;
  const iedRemain = us.ignoreDef.reduce((a, v) => a * (1 - v / 100), 1);
  const defFactor = Math.max(0, 1 - opts.bossDef * iedRemain);
  const finalFactor = us.finalDmg.reduce((a, v) => a * (1 + v / 100), 1);
  return statFactor(cs, us) * atk * dmgFactor * critFactor * defFactor * finalFactor;
}
