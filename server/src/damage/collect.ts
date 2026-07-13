import type { UserStat } from '../dam/statSheet.js';
import { apply, accumPlus, accumIncrease } from './parse.js';

const num = (v: unknown) => Number(v ?? 0) || 0;

const RE_PER_LEVEL = /캐릭터 기준\s*(\d+)레벨 당\s*(.+?)\s*\+\s*(\d+(?:\.\d+)?)/;
export function collectGearItem(us: UserStat, item: any, level = 0): void {
  const t = item?.item_total_option ?? {};
  us.flat.STR += num(t.str); us.flat.DEX += num(t.dex); us.flat.INT += num(t.int); us.flat.LUK += num(t.luk);
  us.allPct += num(t.all_stat);
  us.hpFlat += num(t.max_hp);
  us.atk += num(t.attack_power); us.matk += num(t.magic_power);
  us.bossDmg += num(t.boss_damage);
  us.damage += num(t.damage);
  if (num(t.ignore_monster_armor)) us.ignoreDef.push(num(t.ignore_monster_armor));
  for (const k of ['potential_option_1', 'potential_option_2', 'potential_option_3',
    'additional_potential_option_1', 'additional_potential_option_2', 'additional_potential_option_3']) {
    const line = item?.[k];
    const per = typeof line === 'string' ? line.match(RE_PER_LEVEL) : null;
    if (per) apply(us, per[2], Math.floor(level / Number(per[1])) * Number(per[3]), false);
    else accumPlus(us, line);
  }
  accumPlus(us, item?.soul_option);
}

const SET_MAX_COUNT: [namePrefix: string, max: number][] = [
  ['도전자의 장비 세트', 7],
];
export function collectSet(us: UserStat, setEffect: any[] | undefined): void {
  for (const s of setEffect ?? []) {
    const cap = SET_MAX_COUNT.find(([p]) => String(s.set_name ?? '').startsWith(p))?.[1];
    const count = cap != null ? Math.min(num(s.total_set_count), cap) : num(s.total_set_count);
    for (const tier of s.set_option_full ?? []) {
      if (num(tier.set_count) <= count) accumPlus(us, tier.set_option);
    }
  }
}

export function collectSymbol(us: UserStat, symbols: any[] | undefined): void {
  for (const s of symbols ?? []) {
    us.flatNoPct.STR += num(s.symbol_str); us.flatNoPct.DEX += num(s.symbol_dex);
    us.flatNoPct.INT += num(s.symbol_int); us.flatNoPct.LUK += num(s.symbol_luk);
    us.hpFlatNoPct += num(s.symbol_hp);
  }
}

export function collectHyper(us: UserStat, preset: any[] | undefined): void {
  for (const h of preset ?? []) accumIncrease(us, h.stat_increase, true);
}

export function collectAbility(us: UserStat, abilityInfo: any[] | undefined): void {
  for (const a of abilityInfo ?? []) accumIncrease(us, a.ability_value);
}

export function collectBaseAP(us: UserStat, statMap: Record<string, number>): void {
  us.flat.STR += statMap['AP 배분 STR'] ?? 0;
  us.flat.DEX += statMap['AP 배분 DEX'] ?? 0;
  us.flat.INT += statMap['AP 배분 INT'] ?? 0;
  us.flat.LUK += statMap['AP 배분 LUK'] ?? 0;
}

export function collectTitle(us: UserStat, equip: any): void {
  const desc = equip?.title?.title_description;
  if (typeof desc === 'string') for (const line of desc.split(/[,\n]/)) accumPlus(us, line);
}

export function collectUnion(us: UserStat, raider: any): void {
  for (const line of raider?.union_raider_stat ?? []) accumIncrease(us, line, true);
  for (const line of raider?.union_occupied_stat ?? []) accumIncrease(us, line, false);
  for (const line of raider?.union_state_stat ?? []) accumIncrease(us, line, false);
}

export function collectArtifact(us: UserStat, artifact: any): void {
  for (const e of artifact?.union_artifact_effect ?? []) accumIncrease(us, e?.name, false);
}

export function collectChampion(us: UserStat, champion: any): void {
  for (const e of champion?.champion_badge_total_info ?? []) accumIncrease(us, e?.stat, false);
}

export function collectPropensity(us: UserStat, propensity: any): void {
  const charisma = num(propensity?.charisma_level);
  if (charisma) us.ignoreDef.push(charisma * 0.1);
}

export function collectChallenger(us: UserStat): void {
  us.allFlat += 100;
  us.atk += 80;
  us.matk += 80;
  us.bossDmg += 70;
  us.ignoreDef.push(70);
  us.critRate += 30;
  us.critDmg += 40;
}

export interface BurningBeyond { allStat?: number; atk?: number; matk?: number; bossDmg?: number; ignoreDef?: number; critRate?: number; critDmg?: number; }
export const BURNING_TOOLTIP: BurningBeyond = { allStat: 30, atk: 30, matk: 30, bossDmg: 20, ignoreDef: 20 };
export function hasBurning(skills: Record<string, { skill_name?: string }[]> | undefined): boolean {
  return (skills?.['0'] ?? []).some((s) => s.skill_name === '버닝 BEYOND' || s.skill_name === '하이퍼 버닝 MAX');
}
export function collectBurning(us: UserStat, b?: BurningBeyond): void {
  if (!b) return;
  us.allFlat += b.allStat ?? 0;
  us.atk += b.atk ?? 0;
  us.matk += b.matk ?? 0;
  us.bossDmg += b.bossDmg ?? 0;
  if (b.ignoreDef) us.ignoreDef.push(b.ignoreDef);
  us.critRate += b.critRate ?? 0;
  us.critDmg += b.critDmg ?? 0;
}

export function collectCash(us: UserStat, cash: any): void {
  for (const it of cash?.cash_item_equipment_base ?? []) {
    for (const o of it?.cash_item_option ?? []) {
      const v = num(o?.option_value);
      switch (o?.option_type) {
        case 'STR': us.flat.STR += v; break;
        case 'DEX': us.flat.DEX += v; break;
        case 'INT': us.flat.INT += v; break;
        case 'LUK': us.flat.LUK += v; break;
        case '올스탯': us.allFlat += v; break;
        case '공격력': us.atk += v; break;
        case '마력': us.matk += v; break;
      }
    }
  }
}

export function collectGuild(us: UserStat, guild: any): void {
  const skills = [...(guild?.guild_skill ?? []), ...(guild?.guild_noblesse_skill ?? [])];
  for (const s of skills) {
    const eff = String(s?.skill_effect ?? '');
    if (/\d+\s*(분|초)\s*동안/.test(eff)) continue;
    for (const line of eff.split('\n')) {
      if (line.includes('일반 몬스터') || line.includes('받는 피해')) continue;
      accumIncrease(us, line);
    }
  }
}
