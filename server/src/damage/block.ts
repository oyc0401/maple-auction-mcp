import type { StatBlock, CharacterStats } from './stat-interface.js';
import { emptyUserStat, type UserStat, type MainStat } from './statSheet.js';

export const MAIN: MainStat[] = ['STR', 'DEX', 'INT', 'LUK'];

type Rec = Record<string, number | number[]>;

export function toBlock(u: UserStat): StatBlock {
  const b: Rec = {};
  for (const k of MAIN) if (u.flat[k]) b[k] = u.flat[k];
  for (const k of MAIN) if (u.flatNoPct[k]) b[`${k}미적용`] = u.flatNoPct[k];
  for (const k of MAIN) if (u.pct[k]) b[`${k}%`] = u.pct[k];
  if (u.allFlat) b['올스탯'] = u.allFlat;
  if (u.allPct) b['올스탯%'] = u.allPct;
  if (u.atk) b['공격력'] = u.atk;
  if (u.matk) b['마력'] = u.matk;
  if (u.atkPct) b['공격력%'] = u.atkPct;
  if (u.matkPct) b['마력%'] = u.matkPct;
  if (u.damage) b['데미지'] = u.damage;
  if (u.bossDmg) b['보공'] = u.bossDmg;
  if (u.statusDmg) b['추가뎀'] = u.statusDmg;
  if (u.ignoreDef.length) b['방무'] = u.ignoreDef;
  if (u.finalDmg.length) b['최종뎀'] = u.finalDmg;
  if (u.critRate) b['크확'] = u.critRate;
  if (u.critDmg) b['크뎀'] = u.critDmg;
  if (u.hpFlat) b['HP'] = u.hpFlat;
  if (u.hpFlatNoPct) b['HP미적용'] = u.hpFlatNoPct;
  if (u.hpPct) b['HP%'] = u.hpPct;
  return b as StatBlock;
}

export const isEmptyBlock = (b: StatBlock): boolean => Object.keys(b).length === 0;

export function blockOf(fn: (u: UserStat) => void): StatBlock {
  const u = emptyUserStat();
  fn(u);
  return toBlock(u);
}

export function addBlock(u: UserStat, b: StatBlock, level: number): void {
  const r = b as Rec;
  for (const k of MAIN) {
    u.flat[k] += (r[k] as number) ?? 0;
    u.flatNoPct[k] += (r[`${k}미적용`] as number) ?? 0;
    u.pct[k] += (r[`${k}%`] as number) ?? 0;
    u.flat[k] += Math.floor(level / 9) * ((r[`레벨당${k}`] as number) ?? 0);
    u.flatNoPct[k] += (r['올스탯미적용'] as number) ?? 0;
  }
  u.allFlat += (r['올스탯'] as number) ?? 0;
  u.allPct += (r['올스탯%'] as number) ?? 0;
  u.atk += (r['공격력'] as number) ?? 0;
  u.matk += (r['마력'] as number) ?? 0;
  u.atkPct += (r['공격력%'] as number) ?? 0;
  u.matkPct += (r['마력%'] as number) ?? 0;
  u.damage += (r['데미지'] as number) ?? 0;
  u.bossDmg += (r['보공'] as number) ?? 0;
  u.statusDmg += (r['추가뎀'] as number) ?? 0;
  u.ignoreDef.push(...((r['방무'] as number[]) ?? []));
  u.finalDmg.push(...((r['최종뎀'] as number[]) ?? []));
  u.critRate += (r['크확'] as number) ?? 0;
  u.critDmg += (r['크뎀'] as number) ?? 0;
  u.hpFlat += (r['HP'] as number) ?? 0;
  u.hpFlatNoPct += (r['HP미적용'] as number) ?? 0;
  u.hpPct += (r['HP%'] as number) ?? 0;
}

export function negateBlock(b: StatBlock): StatBlock {
  const out: Rec = {};
  for (const [k, v] of Object.entries(b as Rec)) {
    if (k === '방무') out[k] = (v as number[]).filter((x) => x !== 100).map((x) => 100 * (1 - 1 / (1 - x / 100)));
    else if (k === '최종뎀') out[k] = (v as number[]).map((x) => 100 * (1 / (1 + x / 100) - 1));
    else out[k] = -(v as number);
  }
  return out as StatBlock;
}

const isBlock = (v: object): boolean =>
  Object.values(v).every((x) => typeof x === 'number' || Array.isArray(x));

export function flattenStats(cs: CharacterStats, level: number): UserStat {
  const us = emptyUserStat();
  for (const v of Object.values(cs)) {
    if (v == null || typeof v === 'number') continue;
    if (isBlock(v)) addBlock(us, v as StatBlock, level);
    else for (const b of Object.values(v as Record<string, StatBlock>)) addBlock(us, b, level);
  }
  if (cs.메이플용사) {
    const ap = cs.AP as Rec;
    for (const k of MAIN) us.flat[k] += Math.floor((((ap[k] as number) ?? 0) * cs.메이플용사) / 100);
  }
  return us;
}
