// 일반 환산 주스탯 계산 (곱연산 데미지 모델의 편미분 → 순수 주스탯 환산).
// 근거: maplescouter 구버전 오픈소스 `calc100dmg`(data_format.ts). 확인된 처리:
//   D = (4·주스탯 + 부스탯) × 공격력 × (1+(데미지%+보공%)/100) × 크리팩터 × 방무팩터 × 최종뎀
//   크리팩터 = min(1,크확)·(0.35 + 크뎀/100) + 1
//   방무팩터 = max(0, 1 − 보스방어율(300%)·(1 − 실방무/100))   // monster_guard 고정 300
//   최종뎀·방무는 곱연산 결합.
// 직업 상수(숙련도·무기상수)는 같은 직업 내 무기 교체 Δ에선 상쇄되어 생략한다.
//
// 정확도 한계(v1): 주스탯%/공%는 캐릭터의 순수/％ 분해값이 없어 최종총합 기준으로 근사한다.
// 무기의 올스탯%/공%는 값이 작아 오차가 미미하다. 방무·보공·데미지 비선형은 현재 총합에서 정확히 평가된다.

import type { MainStat } from './jobs.js';

// 환산 기준 보스 방어율(%). maplescouter monster_guard 고정값.
export const BOSS_DEFENSE = 300;

const SUB_OF: Record<MainStat, MainStat> = { STR: 'DEX', DEX: 'STR', INT: 'LUK', LUK: 'DEX' };

// 한 아이템이 데미지에 기여하는 요소. 방무는 곱연산이라 계수(∏(1−방무/100))로 보관.
export interface Contribution {
  main: number; // 주스탯 수치 (해당 주스탯 + 올스탯 수치)
  sub: number; // 부스탯 수치
  mainPct: number; // 주스탯% + 올스탯%
  subPct: number; // 부스탯% + 올스탯%
  atk: number; // 공격력(물리) 또는 마력(마법) 수치
  atkPct: number; // 공% 또는 마%
  dmgBoss: number; // 데미지% + 보스몬스터데미지%
  idaFactor: number; // ∏(1 − 방무_i/100)
  critDmg: number; // 크리티컬 데미지%
  finalDmg: number; // 최종 데미지%
}

// ── 옵션 텍스트 파서 ────────────────────────────────────────────────
// "몬스터 방어율 무시 +40%", "공격력 +9%", "STR, DEX +36", "올스탯 +3%" 등을 카테고리별로 누적.

interface RawOpts {
  str: number; dex: number; int: number; luk: number; allStat: number;
  strPct: number; dexPct: number; intPct: number; lukPct: number; allPct: number;
  atk: number; matk: number; atkPct: number; matkPct: number;
  dmg: number; boss: number; ida: number[]; critDmg: number; finalDmg: number;
}

function emptyRaw(): RawOpts {
  return { str: 0, dex: 0, int: 0, luk: 0, allStat: 0, strPct: 0, dexPct: 0, intPct: 0, lukPct: 0, allPct: 0,
    atk: 0, matk: 0, atkPct: 0, matkPct: 0, dmg: 0, boss: 0, ida: [], critDmg: 0, finalDmg: 0 };
}

const OPT_RE = /^(.+?)\s*\+\s*(-?\d+(?:\.\d+)?)\s*(%?)$/;

function accumOpt(raw: RawOpts, seg: string) {
  const m = seg.trim().match(OPT_RE);
  if (!m) return;
  const label = m[1].trim();
  const val = Number(m[2]);
  const pct = m[3] === '%';
  for (const one of label.split(',').map((s) => s.trim())) {
    switch (one) {
      case 'STR': pct ? (raw.strPct += val) : (raw.str += val); break;
      case 'DEX': pct ? (raw.dexPct += val) : (raw.dex += val); break;
      case 'INT': pct ? (raw.intPct += val) : (raw.int += val); break;
      case 'LUK': pct ? (raw.lukPct += val) : (raw.luk += val); break;
      case '올스탯': pct ? (raw.allPct += val) : (raw.allStat += val); break;
      case '공격력': pct ? (raw.atkPct += val) : (raw.atk += val); break;
      case '마력': pct ? (raw.matkPct += val) : (raw.matk += val); break;
      case '데미지': if (pct) raw.dmg += val; break;
      case '보스 몬스터 데미지':
      case '보스 데미지': if (pct) raw.boss += val; break;
      case '몬스터 방어율 무시': if (pct) raw.ida.push(val); break;
      case '크리티컬 데미지': if (pct) raw.critDmg += val; break;
      case '최종 데미지': if (pct) raw.finalDmg += val; break;
      default: break; // 환산 무관(최대HP·크확·상태이상내성 등)
    }
  }
}

function accumSummaryLine(raw: RawOpts, line: string | null | undefined) {
  if (!line) return;
  const body = line.includes(':') ? line.slice(line.indexOf(':') + 1) : line;
  for (const seg of body.split('/')) accumOpt(raw, seg);
}

function toContribution(raw: RawOpts, mainStat: MainStat, isMagic: boolean): Contribution {
  const byName: Record<MainStat, number> = { STR: raw.str, DEX: raw.dex, INT: raw.int, LUK: raw.luk };
  const pctByName: Record<MainStat, number> = { STR: raw.strPct, DEX: raw.dexPct, INT: raw.intPct, LUK: raw.lukPct };
  const sub = SUB_OF[mainStat];
  return {
    main: byName[mainStat] + raw.allStat,
    sub: byName[sub] + raw.allStat,
    mainPct: pctByName[mainStat] + raw.allPct,
    subPct: pctByName[sub] + raw.allPct,
    atk: isMagic ? raw.matk : raw.atk,
    atkPct: isMagic ? raw.matkPct : raw.atkPct,
    dmgBoss: raw.dmg + raw.boss,
    idaFactor: raw.ida.reduce((f, v) => f * (1 - v / 100), 1),
    critDmg: raw.critDmg,
    finalDmg: raw.finalDmg,
  };
}

// 경매장 매물 요약(finalStat 수치 + 잠재/에디 텍스트) → Contribution.
export function contributionFromAuction(
  item: { finalStat: Record<string, number> | null; potential: string | null; additional: string | null },
  mainStat: MainStat,
  isMagic: boolean
): Contribution {
  const raw = emptyRaw();
  const fs = item.finalStat ?? {};
  raw.str = fs.str ?? 0; raw.dex = fs.dex ?? 0; raw.int = fs.int ?? 0; raw.luk = fs.luk ?? 0;
  raw.allPct = fs.all ?? 0; // finalStat.all = 올스탯%
  raw.atk = fs.pad ?? 0; raw.matk = fs.mad ?? 0;
  raw.dmg = fs.dam ?? 0; raw.boss = fs.bdr ?? 0;
  if (fs.imdr) raw.ida.push(fs.imdr); // 고정+추옵 방무
  accumSummaryLine(raw, item.potential);
  accumSummaryLine(raw, item.additional);
  return toContribution(raw, mainStat, isMagic);
}

// 넥슨 오픈 API item-equipment 아이템 → Contribution (현재 무기).
export function contributionFromEquip(equip: any, mainStat: MainStat, isMagic: boolean): Contribution {
  const raw = emptyRaw();
  const t = equip.item_total_option ?? {};
  raw.str = Number(t.str ?? 0); raw.dex = Number(t.dex ?? 0); raw.int = Number(t.int ?? 0); raw.luk = Number(t.luk ?? 0);
  raw.allPct = Number(t.all_stat ?? 0);
  raw.atk = Number(t.attack_power ?? 0); raw.matk = Number(t.magic_power ?? 0);
  raw.dmg = Number(t.damage ?? 0); raw.boss = Number(t.boss_damage ?? 0);
  const ida = Number(t.ignore_monster_armor ?? 0);
  if (ida) raw.ida.push(ida);
  for (const k of ['potential_option_1', 'potential_option_2', 'potential_option_3',
    'additional_option_1', 'additional_option_2', 'additional_option_3']) {
    accumSummaryLine(raw, equip[k]);
  }
  return toContribution(raw, mainStat, isMagic);
}

// ── 데미지 배수 D ─────────────────────────────────────────────────
export interface SpecTotals {
  main: number; sub: number; attack: number; damageBossSum: number;
  ignoreDef: number; critRate: number; critDamage: number; finalDamage: number;
}

function critFactor(critRate: number, critDamage: number): number {
  const p = Math.min(1, critRate / 100);
  return p * (0.35 + critDamage / 100) + 1;
}

export function damageMultiplier(s: SpecTotals): number {
  const statFactor = 4 * s.main + s.sub;
  const dmgFactor = 1 + s.damageBossSum / 100;
  const defFactor = Math.max(0, 1 - (BOSS_DEFENSE / 100) * (1 - s.ignoreDef / 100));
  const finalFactor = 1 + s.finalDamage / 100;
  return statFactor * s.attack * dmgFactor * critFactor(s.critRate, s.critDamage) * defFactor * finalFactor;
}

// 현재 무기를 candidate로 교체했을 때 캐릭터의 새 총합.
function swapTotals(base: SpecTotals, cur: Contribution, cand: Contribution): SpecTotals {
  const curNoWeaponFactor = (1 - base.ignoreDef / 100) / (cur.idaFactor || 1); // 무기 제외 상태의 (1−실방무)
  const newIgnore = 100 * (1 - curNoWeaponFactor * cand.idaFactor);
  return {
    main: base.main - cur.main - base.main * (cur.mainPct / 100) + cand.main + base.main * (cand.mainPct / 100),
    sub: base.sub - cur.sub - base.sub * (cur.subPct / 100) + cand.sub + base.sub * (cand.subPct / 100),
    attack: base.attack - cur.atk - base.attack * (cur.atkPct / 100) + cand.atk + base.attack * (cand.atkPct / 100),
    damageBossSum: base.damageBossSum - cur.dmgBoss + cand.dmgBoss,
    ignoreDef: newIgnore,
    critRate: base.critRate,
    critDamage: base.critDamage - cur.critDmg + cand.critDmg,
    finalDamage: base.finalDamage - cur.finalDmg + cand.finalDmg,
  };
}

// Δ환산: 현재 무기(cur)를 candidate로 교체 시 오르는 환산 주스탯. 음수면 하락.
export function hwansanDiff(base: SpecTotals, cur: Contribution, cand: Contribution): number {
  const before = damageMultiplier(base);
  if (before <= 0) return 0;
  const after = damageMultiplier(swapTotals(base, cur, cand));
  const statFactor = 4 * base.main + base.sub;
  return ((after / before - 1) * statFactor) / 4;
}
