import type { ScouterUserStat } from '../scouter/dmgSimulatorPayload.js';
import { emptyUserStat, type UserStat, type MainStat } from './statSheet.js';
import { statAxesOf, type CombatStats } from './combat.js';

export function scouterToUserStat(su: ScouterUserStat): UserStat {
  const u = emptyUserStat();
  const s = su.stat;
  const e = su.entireStat;
  const axes = statAxesOf(s.myClass, { STR: e.str, DEX: e.dex, INT: e.int, LUK: e.luk });

  const put = (k: MainStat, base: number, per: number, abs: number) => {
    u.flat[k] = base; u.pct[k] = per; u.flatNoPct[k] = abs;
  };
  if (axes.kind === 'standard') {
    put(axes.main, s.mainStatBase, s.mainStatPer, s.mainStatAbs);
    put(axes.sub, s.subStatBase, s.subStatPer, s.subStatAbs);
    if (axes.ssub) put(axes.ssub, s.ssubStatBase, s.ssubStatPer, s.ssubStatAbs);
  } else {
    put('STR', s.mainStatBase, s.mainStatPer, s.mainStatAbs);
    put('DEX', s.subStatBase, s.subStatPer, s.subStatAbs);
  }

  const magic = axes.kind === 'standard' && axes.isMagic;
  if (magic) { u.matk = s.atkBase; u.matkPct = s.atkPercent; }
  else { u.atk = s.atkBase; u.atkPct = s.atkPercent; }

  u.damage = s.dmg;
  u.bossDmg = s.bossDmg;
  u.statusDmg = s.statusAdditionalDmg;
  u.critRate = s.critical;
  u.critDmg = s.criticalDmg;
  if (s.ignoreDef) u.ignoreDef = [s.ignoreDef];
  return u;
}

export function combatStatsFromScouter(su: ScouterUserStat): CombatStats {
  const us = scouterToUserStat(su);
  const e = su.entireStat;
  const axes = statAxesOf(su.stat.myClass, { STR: e.str, DEX: e.dex, INT: e.int, LUK: e.luk });
  const notes: string[] = [];
  if (axes.kind !== 'standard') notes.push('제논·데몬어벤져 축은 미검증 — 증감률 참고용');
  return {
    myClass: su.stat.myClass, level: su.stat.level, axes, us,
    critRateTotal: us.critRate, critReinforcePct: 0, notes,
  };
}
