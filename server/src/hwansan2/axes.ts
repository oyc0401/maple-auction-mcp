// 아이템(현재 장비/경매장 매물) → 정규화 스탯(ItemStats) → dmg-simulator 축 델타.
// 축 의미는 실측 기반: mainStat 등 깡스탯 축은 %적용 base, *Per는 스탯%, ignoreGuard는 %p 가산.
// 아이템 방무는 곱연산이므로 우리가 실방무'를 계산해 %p 델타만 서버에 전달한다.
import { parseOptionLine } from './optionDict.js';
import type { ScouterEquip, ScouterData } from './scouterClient.js';

export type Stat4 = 'STR' | 'DEX' | 'INT' | 'LUK';

export interface ItemStats {
  flat: Record<Stat4, number>;
  hp: number; hpPct: number;
  atk: number; matk: number;
  dispAtk: number; dispMatk: number; // 툴팁 표시 공격력/마력(base+주문서+스타포스+추옵 합). 무기 weaponAtk 절대축의 원천
  perLev: Record<Stat4, number>;     // "캐릭터 기준 9레벨 당 스탯 +n" — 캐릭 레벨을 곱해 깡스탯으로 환산(toSimulatorDelta)
  pct: Record<Stat4, number>; allPct: number;
  atkPct: number; matkPct: number;
  dmgBoss: number;   // 데미지%+보스뎀% (calc상 합산 등가 → bossDmg 축 하나로 전달)
  iedFactor: number; // ∏(1 − 방무/100)
  critDmg: number; finalDmg: number; coolSec: number; critRate: number;
  unknown: string[];
}

export function emptyItemStats(): ItemStats {
  return {
    flat: { STR: 0, DEX: 0, INT: 0, LUK: 0 }, hp: 0, hpPct: 0, atk: 0, matk: 0,
    dispAtk: 0, dispMatk: 0, perLev: { STR: 0, DEX: 0, INT: 0, LUK: 0 },
    pct: { STR: 0, DEX: 0, INT: 0, LUK: 0 }, allPct: 0, atkPct: 0, matkPct: 0,
    dmgBoss: 0, iedFactor: 1, critDmg: 0, finalDmg: 0, coolSec: 0, critRate: 0, unknown: [],
  };
}

export function accumLine(s: ItemStats, line: string | null | undefined) {
  const p = parseOptionLine(line);
  if (!p) return;
  if ('unknown' in p) { s.unknown.push(p.unknown); return; }
  const { key, val, pct } = p;
  switch (key) {
    case 'STR': case 'DEX': case 'INT': case 'LUK':
      pct ? (s.pct[key] += val) : (s.flat[key] += val); break;
    case 'allStat': pct ? (s.allPct += val) : (['STR', 'DEX', 'INT', 'LUK'] as Stat4[]).forEach((k) => (s.flat[k] += val)); break;
    case 'hp': pct ? (s.hpPct += val) : (s.hp += val); break;
    case 'atk': pct ? (s.atkPct += val) : (s.atk += val); break;
    case 'matk': pct ? (s.matkPct += val) : (s.matk += val); break;
    case 'dmg': case 'boss': if (pct) s.dmgBoss += val; break;
    case 'ied': if (pct) s.iedFactor *= 1 - val / 100; break;
    case 'critDmg': if (pct) s.critDmg += val; break;
    case 'finalDmg': if (pct) s.finalDmg += val; break;
    case 'coolSec': s.coolSec += val; break;
    case 'critRate': if (pct) s.critRate += val; break;
    case 'perLevSTR': s.perLev.STR += val; break;
    case 'perLevDEX': s.perLev.DEX += val; break;
    case 'perLevINT': s.perLev.INT += val; break;
    case 'perLevLUK': s.perLev.LUK += val; break;
  }
}

// 스카우터 userEquipData 항목(넥슨 분해옵션 + 잠재/에디 배열 + 소울) → ItemStats
export function fromScouterEquip(e: ScouterEquip): ItemStats {
  const s = emptyItemStats();
  const t = e.totalOption ?? {};
  const n = (k: string) => Number(t[k] ?? 0);
  s.flat.STR += n('str'); s.flat.DEX += n('dex'); s.flat.INT += n('int'); s.flat.LUK += n('luk');
  s.hp += n('max_hp'); s.atk += n('attack_power'); s.matk += n('magic_power');
  s.dispAtk = n('attack_power'); s.dispMatk = n('magic_power');
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
  s.dispAtk = fs.pad ?? 0; s.dispMatk = fs.mad ?? 0;
  s.dmgBoss += (fs.bdr ?? 0) + (fs.dam ?? 0);
  s.allPct += fs.all ?? 0;
  if (fs.imdr) s.iedFactor *= 1 - fs.imdr / 100;
  const ui = tt.upgradeInfo ?? {};
  for (const e of ui.potential?.entries ?? []) accumLine(s, e.text);
  for (const e of ui.additionalPotential?.entries ?? []) accumLine(s, e.text);
  if (tt.soulWeapon?.optionText) accumLine(s, tt.soulWeapon.optionText);
  return s;
}

// 직업별 축 매핑. 이중부스탯(카데나·듀얼블레이드·섀도어): sub=DEX, ssub=STR
// (스카우터 payload의 subStatBase>ssubStatBase 실측과 부합. 깡부스탯 효율은 두 축 동일이라 뒤집혀도 무해,
//  부스탯 개별 %줄만 영향). 데벤져는 HP가 주스탯(sub=STR), 제논은 STR+DEX+LUK 합산을 main 축으로 전달
// (스카우터 서버가 직업을 알고 계산 — 우리는 아이템 수치를 올바른 축에 싣기만 한다).
const DOUBLE_SUB = new Set(['카데나', '듀얼블레이드', '섀도어']);
const SUB_OF: Record<Stat4, Stat4> = { STR: 'DEX', DEX: 'STR', INT: 'LUK', LUK: 'DEX' };

export type StatAxes =
  | { kind: 'standard'; main: Stat4; sub: Stat4; ssub: Stat4 | null; isMagic: boolean }
  | { kind: 'da' }     // 데몬어벤져: main=최대HP(깡/%), sub=STR, 물리
  | { kind: 'xenon' }; // 제논: STR+DEX+LUK 깡 합산 → mainStat, 개별 스탯% 합 → mainStatPer, 물리

export function statAxes(userStat: ScouterData['userStat']): StatAxes {
  const myClass = String(userStat.stat?.myClass ?? '');
  if (myClass === '데몬어벤져') return { kind: 'da' };
  if (myClass === '제논') return { kind: 'xenon' };
  const entire = (userStat as any).entireStat ?? {};
  const cand: [Stat4, number][] = [
    ['STR', Number(entire.str ?? 0)], ['DEX', Number(entire.dex ?? 0)],
    ['INT', Number(entire.int ?? 0)], ['LUK', Number(entire.luk ?? 0)],
  ];
  cand.sort((a, b) => b[1] - a[1]);
  const main = cand[0][0];
  if (DOUBLE_SUB.has(myClass)) return { kind: 'standard', main, sub: 'DEX', ssub: 'STR', isMagic: false };
  return { kind: 'standard', main, sub: SUB_OF[main], ssub: null, isMagic: main === 'INT' };
}

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(5));

// (새 − 현재 + 세트델타) → simulator 축. 전부 0이면 null(POST 불필요).
// 실측 기반(2026-07-09, 아케인셰이드 체인→제네시스 체인 캡처 payload 재현):
// - 무기 교체 시 weaponAtk 절대축 = 새 무기의 "표시 공격력"(dispAtk, base+주문서+★+추옵 합. 제네 체인 832).
//   atk 델타축은 방어구와 동일하게 정상 델타 그대로 둔다(실측 atk=267=Δ247+세트20 — 이중이 아니라 스카우터 방식).
// - level을 주면 "9레벨 당 스탯 +n"(perLev)을 floor(level/9)×n 깡스탯으로 환산해 축에 가산(실측 mainStat 170=110+60).
export function toSimulatorDelta(
  cur: ItemStats,
  next: ItemStats,
  setDelta: ItemStats,
  ax: StatAxes,
  baseIgnoreDef: number,
  extra: { level?: number; weaponAtkBase?: number } = {}
): Record<string, string> | null {
  const d = (f: (s: ItemStats) => number) => f(next) - f(cur) + f(setDelta);
  const isMagic = ax.kind === 'standard' && ax.isMagic;
  const atkOf = (s: ItemStats) => (isMagic ? s.matk : s.atk);
  const atkPctOf = (s: ItemStats) => (isMagic ? s.matkPct : s.atkPct);
  // "9레벨 당 스탯"은 캐릭터 레벨로 깡스탯 환산해 해당 축에 합산
  const lv9 = Math.floor((extra.level ?? 0) / 9);
  const flatOf = (s: ItemStats, k: Stat4) => s.flat[k] + lv9 * s.perLev[k];
  // 직업군별 main/sub 축 수치 선택
  const mainOf = (s: ItemStats) =>
    ax.kind === 'da' ? s.hp : ax.kind === 'xenon' ? flatOf(s, 'STR') + flatOf(s, 'DEX') + flatOf(s, 'LUK') : flatOf(s, ax.main);
  const mainPctOf = (s: ItemStats) =>
    ax.kind === 'da' ? s.hpPct : ax.kind === 'xenon' ? s.pct.STR + s.pct.DEX + s.pct.LUK : s.pct[ax.main];
  const subOf = (s: ItemStats) =>
    ax.kind === 'da' ? flatOf(s, 'STR') : ax.kind === 'xenon' ? 0 : flatOf(s, ax.sub);
  const subPctOf = (s: ItemStats) =>
    ax.kind === 'da' ? s.pct.STR : ax.kind === 'xenon' ? 0 : s.pct[ax.sub];
  const ssubOf = (s: ItemStats) => (ax.kind === 'standard' && ax.ssub ? flatOf(s, ax.ssub) : 0);
  const ssubPctOf = (s: ItemStats) => (ax.kind === 'standard' && ax.ssub ? s.pct[ax.ssub] : 0);

  // 방무: base 실방무에서 현재 아이템 계수를 나눠 빼고 (새 아이템 × 세트델타) 계수를 곱해 %p 차이 산출
  const iedNext = next.iedFactor * setDelta.iedFactor;
  const after = 100 * (1 - ((1 - baseIgnoreDef / 100) / (cur.iedFactor || 1)) * iedNext);
  const dIgn = after - baseIgnoreDef;

  const out: Record<string, number> = {
    mainStat: d(mainOf),
    subStat: d(subOf),
    ssubStat: d(ssubOf),
    mainStatPer: d(mainPctOf),
    subStatPer: d(subPctOf),
    ssubStatPer: d(ssubPctOf),
    allStatPer: d((s) => s.allPct),
    atk: d(atkOf),
    atkPer: d(atkPctOf),
    bossDmg: d((s) => s.dmgBoss),
    criDmg: d((s) => s.critDmg),
    finalDmg: d((s) => s.finalDmg),
    coolTimeReduce: d((s) => s.coolSec),
    ignoreGuard: dIgn,
    criRate: d((s) => s.critRate),
  };

  // 무기 교체: weaponAtk 절대축 = 새 무기의 표시 공격력(마법 직업은 표시 마력). atk 델타축은 그대로 둔다.
  const weaponAtkNext = extra.weaponAtkBase != null ? (isMagic ? next.dispMatk : next.dispAtk) : null;

  const deltasZero = Object.values(out).every((v) => Math.abs(v) < 1e-9);
  const weaponSame = weaponAtkNext == null || Math.abs(weaponAtkNext - extra.weaponAtkBase!) < 1e-9;
  if (deltasZero && weaponSame) return null;

  const entries: [string, string][] = Object.entries(out).map(([k, v]) => [k, fmt(v)]);
  if (weaponAtkNext != null) entries.push(['weaponAtk', fmt(weaponAtkNext)]);
  return Object.fromEntries(entries);
}
