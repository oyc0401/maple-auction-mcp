import { fromAuctionRaw, type ItemStats, type Stat4 } from '../hwansan2/axes.js';
import { parseOptionLine } from '../hwansan2/optionDict.js';
import { setSwapStatsByNames, normalizeSet } from '../hwansan2/sets.js';
import type { StatBlock } from './stat-interface.js';
import type { CharacterCollected } from './nexon.js';
import { SLOT_KEY } from './character.js';
import { addBlock, negateBlock } from './block.js';
import { damageOf, type CombatStats } from './combat.js';

export function itemStatsToBlock(s: ItemStats): StatBlock {
  const b: Record<string, number | number[]> = {};
  for (const k of ['STR', 'DEX', 'INT', 'LUK'] as Stat4[]) {
    if (s.flat[k]) b[k] = s.flat[k];
    if (s.pct[k]) b[`${k}%`] = s.pct[k];
    if (s.perLev[k]) b[`레벨당${k}`] = s.perLev[k];
  }
  if (s.allPct) b['올스탯%'] = s.allPct;
  if (s.atk) b['공격력'] = s.atk;
  if (s.matk) b['마력'] = s.matk;
  if (s.atkPct) b['공격력%'] = s.atkPct;
  if (s.matkPct) b['마력%'] = s.matkPct;
  if (s.dmgBoss) b['보공'] = s.dmgBoss;
  if (s.iedFactor !== 1) b['방무'] = [(1 - s.iedFactor) * 100];
  if (s.finalDmg) b['최종뎀'] = [s.finalDmg];
  if (s.critRate) b['크확'] = s.critRate;
  if (s.critDmg) b['크뎀'] = s.critDmg;
  if (s.hp) b['HP'] = s.hp;
  if (s.hpPct) b['HP%'] = s.hpPct;
  if (s.coolSec) b['쿨감'] = s.coolSec;
  return b as StatBlock;
}

const POTENTIAL_KEYS = [
  'potential_option_1', 'potential_option_2', 'potential_option_3',
  'additional_potential_option_1', 'additional_potential_option_2', 'additional_potential_option_3',
];
function unknownLines(item: any): string[] {
  const out: string[] = [];
  for (const line of [...POTENTIAL_KEYS.map((k) => item?.[k]), item?.soul_option]) {
    const p = parseOptionLine(line);
    if (p && 'unknown' in p) out.push(p.unknown);
  }
  return out;
}

export interface SwapResult {
  delta380: number;
  unknown: string[];
}

const round2 = (v: number) => Math.round(v * 100) / 100 || 0;
const num = (b: StatBlock, k: string) => ((b as Record<string, number>)[k] ?? 0);

export function swapDamageDelta(
  collected: CharacterCollected,
  cs: CombatStats,
  slot: string,
  newItemRaw: any
): SwapResult | null {
  const equips: any[] = collected.raw.equip?.item_equipment ?? [];
  const cur = equips.find((e) => e.item_equipment_slot === slot);
  if (!cur) return null;

  const gearBlocks = (collected.stats.장비 ?? {}) as Record<string, StatBlock>;
  const curBlock: StatBlock = { ...(gearBlocks[SLOT_KEY[slot] ?? slot] ?? {}) };
  const nextStats = fromAuctionRaw(newItemRaw);
  const newBlock = itemStatsToBlock(nextStats);
  const unknown = new Set([...unknownLines(cur), ...nextStats.unknown]);
  const newName = String(newItemRaw?.itemName ?? '');

  if (slot === '무기') {
    if (/^제네시스 /.test(String(cur.item_name ?? ''))) curBlock.최종뎀 = [...(curBlock.최종뎀 ?? []), 10];
    if (/^제네시스 /.test(newName)) newBlock.최종뎀 = [...(newBlock.최종뎀 ?? []), 10];
  }

  const names = equips.map((e) => String(e.item_name ?? ''));
  const idx = equips.findIndex((e) => e.item_equipment_slot === slot);
  const namesAfter = [...names];
  namesAfter[idx] = newName;
  const dawn = (collected.raw.setEff?.set_effect ?? []).find((s: any) => /여명/.test(String(s.set_name ?? '')));
  const setOpts = { aliases: {} as Record<string, string>, dawnCount: Number(dawn?.total_set_count ?? 0) };
  const officialNewSet = normalizeSet(newItemRaw?.toolTip?.setEffects?.[0]);
  if (officialNewSet) setOpts.aliases[newName] = officialNewSet;
  const setDeltaBlock = itemStatsToBlock(setSwapStatsByNames(names, namesAfter, setOpts));

  const usAfter = structuredClone(cs.us);
  addBlock(usAfter, newBlock, cs.level);
  addBlock(usAfter, setDeltaBlock, cs.level);
  addBlock(usAfter, negateBlock(curBlock), cs.level);
  const critRateDelta = num(newBlock, '크확') + num(setDeltaBlock, '크확') - num(curBlock, '크확');

  const deltaAt = (bossDef: number) => {
    const before = damageOf(cs, { bossDef });
    const after = damageOf(cs, { bossDef, critRateDelta }, usAfter);
    return before > 0 ? round2((after / before - 1) * 100) : 0;
  };
  return { delta380: deltaAt(3.8), unknown: [...unknown] };
}
