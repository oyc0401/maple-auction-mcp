// 아이템(현재 장비/경매장 매물) → 정규화 스탯(ItemStats) → dmg-simulator 축 델타.
// 축 의미는 실측 기반: mainStat 등 깡스탯 축은 %적용 base, *Per는 스탯%, ignoreGuard는 %p 가산.
// 아이템 방무는 곱연산이므로 우리가 실방무'를 계산해 %p 델타만 서버에 전달한다.
import { parseOptionLine } from './optionDict.js';
import type { ScouterEquip, ScouterData } from './scouterClient.js';

export type Stat4 = 'STR' | 'DEX' | 'INT' | 'LUK';

export interface ItemStats {
  flat: Record<Stat4, number>;
  hp: number;
  atk: number; matk: number;
  pct: Record<Stat4, number>; allPct: number;
  atkPct: number; matkPct: number;
  dmgBoss: number;   // 데미지%+보스뎀% (calc상 합산 등가 → bossDmg 축 하나로 전달)
  iedFactor: number; // ∏(1 − 방무/100)
  critDmg: number; finalDmg: number; coolSec: number;
  unknown: string[];
}

export function emptyItemStats(): ItemStats {
  return {
    flat: { STR: 0, DEX: 0, INT: 0, LUK: 0 }, hp: 0, atk: 0, matk: 0,
    pct: { STR: 0, DEX: 0, INT: 0, LUK: 0 }, allPct: 0, atkPct: 0, matkPct: 0,
    dmgBoss: 0, iedFactor: 1, critDmg: 0, finalDmg: 0, coolSec: 0, unknown: [],
  };
}

function accumLine(s: ItemStats, line: string | null | undefined) {
  const p = parseOptionLine(line);
  if (!p) return;
  if ('unknown' in p) { s.unknown.push(p.unknown); return; }
  const { key, val, pct } = p;
  switch (key) {
    case 'STR': case 'DEX': case 'INT': case 'LUK':
      pct ? (s.pct[key] += val) : (s.flat[key] += val); break;
    case 'allStat': pct ? (s.allPct += val) : (['STR', 'DEX', 'INT', 'LUK'] as Stat4[]).forEach((k) => (s.flat[k] += val)); break;
    case 'hp': if (!pct) s.hp += val; break;
    case 'atk': pct ? (s.atkPct += val) : (s.atk += val); break;
    case 'matk': pct ? (s.matkPct += val) : (s.matk += val); break;
    case 'dmg': case 'boss': if (pct) s.dmgBoss += val; break;
    case 'ied': if (pct) s.iedFactor *= 1 - val / 100; break;
    case 'critDmg': if (pct) s.critDmg += val; break;
    case 'finalDmg': if (pct) s.finalDmg += val; break;
    case 'coolSec': s.coolSec += val; break;
  }
}

// 스카우터 userEquipData 항목(넥슨 분해옵션 + 잠재/에디 배열 + 소울) → ItemStats
export function fromScouterEquip(e: ScouterEquip): ItemStats {
  const s = emptyItemStats();
  const t = e.totalOption ?? {};
  const n = (k: string) => Number(t[k] ?? 0);
  s.flat.STR += n('str'); s.flat.DEX += n('dex'); s.flat.INT += n('int'); s.flat.LUK += n('luk');
  s.hp += n('max_hp'); s.atk += n('attack_power'); s.matk += n('magic_power');
  s.dmgBoss += n('boss_damage') + n('damage');
  s.allPct += n('all_stat'); // 넥슨 total의 all_stat은 %값(추옵 올스탯%)
  const ied = n('ignore_monster_armor');
  if (ied) s.iedFactor *= 1 - ied / 100;
  for (const line of e.potential_option_1 ?? []) accumLine(s, line);
  for (const line of e.additional_potential_option_1 ?? []) accumLine(s, line);
  accumLine(s, e.soul_option);
  return s;
}

// 경매장 매물 원본(toolTip.stat 수치 + 잠재/에디 entries[].text + 소울) → ItemStats
export function fromAuctionRaw(raw: any): ItemStats {
  const s = emptyItemStats();
  const tt = raw?.toolTip ?? {};
  const fs = tt.stat ?? {};
  s.flat.STR += fs.str ?? 0; s.flat.DEX += fs.dex ?? 0; s.flat.INT += fs.int ?? 0; s.flat.LUK += fs.luk ?? 0;
  s.hp += fs.mhp ?? 0; s.atk += fs.pad ?? 0; s.matk += fs.mad ?? 0;
  s.dmgBoss += (fs.bdr ?? 0) + (fs.dam ?? 0);
  s.allPct += fs.all ?? 0;
  if (fs.imdr) s.iedFactor *= 1 - fs.imdr / 100;
  const ui = tt.upgradeInfo ?? {};
  for (const e of ui.potential?.entries ?? []) accumLine(s, e.text);
  for (const e of ui.additionalPotential?.entries ?? []) accumLine(s, e.text);
  if (tt.soulWeapon?.optionText) accumLine(s, tt.soulWeapon.optionText);
  return s;
}

// 직업별 축 매핑. 이중부스탯(카데나·듀얼블레이더·섀도어): sub=DEX, ssub=STR
// (스카우터 payload의 subStatBase>ssubStatBase 실측과 부합. 깡부스탯 효율은 두 축 동일이라 뒤집혀도 무해,
//  부스탯 개별 %줄만 영향 — cli 포킹으로 재검증). 제논·데벤져는 stat 블록 구조가 달라 미지원(null).
const DOUBLE_SUB = new Set(['카데나', '듀얼블레이더', '섀도어']);
const SUB_OF: Record<Stat4, Stat4> = { STR: 'DEX', DEX: 'STR', INT: 'LUK', LUK: 'DEX' };

export function statAxes(userStat: ScouterData['userStat']):
  { main: Stat4; sub: Stat4; ssub: Stat4 | null; isMagic: boolean } | null {
  const myClass = String(userStat.stat?.myClass ?? '');
  if (myClass === '제논' || myClass === '데몬어벤져') return null;
  const entire = (userStat as any).entireStat ?? {};
  const cand: [Stat4, number][] = [
    ['STR', Number(entire.str ?? 0)], ['DEX', Number(entire.dex ?? 0)],
    ['INT', Number(entire.int ?? 0)], ['LUK', Number(entire.luk ?? 0)],
  ];
  cand.sort((a, b) => b[1] - a[1]);
  const main = cand[0][0];
  if (DOUBLE_SUB.has(myClass)) return { main, sub: 'DEX', ssub: 'STR', isMagic: false };
  return { main, sub: SUB_OF[main], ssub: null, isMagic: main === 'INT' };
}

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(5));

// (새 − 현재 + 세트델타) → simulator 축. 전부 0이면 null(POST 불필요).
export function toSimulatorDelta(
  cur: ItemStats,
  next: ItemStats,
  setDelta: ItemStats,
  ax: { main: Stat4; sub: Stat4; ssub: Stat4 | null; isMagic: boolean },
  baseIgnoreDef: number
): Record<string, string> | null {
  const d = (f: (s: ItemStats) => number) => f(next) - f(cur) + f(setDelta);
  const atkOf = (s: ItemStats) => (ax.isMagic ? s.matk : s.atk);
  const atkPctOf = (s: ItemStats) => (ax.isMagic ? s.matkPct : s.atkPct);

  // 방무: base 실방무에서 현재 아이템 계수를 나눠 빼고 (새 아이템 × 세트델타) 계수를 곱해 %p 차이 산출
  const iedNext = next.iedFactor * setDelta.iedFactor;
  const after = 100 * (1 - ((1 - baseIgnoreDef / 100) / cur.iedFactor) * iedNext);
  const dIgn = after - baseIgnoreDef;

  const out: Record<string, number> = {
    mainStat: d((s) => s.flat[ax.main]),
    subStat: d((s) => s.flat[ax.sub]),
    ssubStat: ax.ssub ? d((s) => s.flat[ax.ssub!]) : 0,
    mainStatPer: d((s) => s.pct[ax.main]),
    subStatPer: d((s) => s.pct[ax.sub]),
    ssubStatPer: ax.ssub ? d((s) => s.pct[ax.ssub!]) : 0,
    allStatPer: d((s) => s.allPct),
    atk: d(atkOf),
    atkPer: d(atkPctOf),
    bossDmg: d((s) => s.dmgBoss),
    criDmg: d((s) => s.critDmg),
    finalDmg: d((s) => s.finalDmg),
    coolTimeReduce: d((s) => s.coolSec),
    ignoreGuard: dIgn,
  };
  if (Object.values(out).every((v) => Math.abs(v) < 1e-9)) return null;
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, fmt(v)]));
}
