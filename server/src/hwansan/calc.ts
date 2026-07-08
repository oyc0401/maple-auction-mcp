// 일반 환산 주스탯 계산 (곱연산 데미지 모델의 편미분 → 순수 주스탯 환산).
// 근거: maplescouter 구버전 오픈소스 `calc100dmg`(data_format.ts). 확인된 처리:
//   D = StatFactor × 공격력 × (1+(데미지%+보공%)/100) × 크리팩터 × 방무팩터 × 최종뎀
//   크리팩터 = min(1,크확)·(0.35 + 크뎀/100) + 1
//   방무팩터 = max(0, 1 − 보스방어율(300%)·(1 − 실방무/100))   // monster_guard 고정 300
//   최종뎀·방무는 곱연산. 직업 상수(숙련도·무기상수)는 같은 직업 내 교체 Δ에선 상쇄되어 생략.
// StatFactor는 직업 모델별로 다름(standard / xenon / hp) — jobs.ts 참고.
//
// 정확도 한계(v1): 스탯%/공%는 캐릭터의 순수/％ 분해값이 없어 최종총합 기준으로 근사한다.
// 무기/방어구의 올스탯%/공% 값은 작아 오차가 미미하다. 방무·보공·데미지 비선형은 현재 총합에서 정확히 평가된다.

import type { StatModel } from './jobs.js';

// 환산 기준 보스 방어율(%). maplescouter monster_guard 고정값.
export const BOSS_DEFENSE = 300;

// 한 아이템이 데미지에 기여하는 요소 (모델 무관 원시값). 방무는 곱연산이라 계수(∏(1−방무/100))로 보관.
export interface Contribution {
  str: number; dex: number; int: number; luk: number; hp: number; allStat: number; // 수치
  strPct: number; dexPct: number; intPct: number; lukPct: number; allPct: number; hpPct: number; // %
  atk: number; matk: number; atkPct: number; matkPct: number;
  dmgBoss: number; // 데미지% + 보스몬스터데미지%
  idaFactor: number; // ∏(1 − 방무_i/100)
  critDmg: number; // 크리티컬 데미지%
  finalDmg: number; // 최종 데미지%
}

// 캐릭터 현재 최종 총합 + 직업 모델 (character/stat 기반).
export interface CharState {
  model: StatModel;
  str: number; dex: number; int: number; luk: number; hp: number; level: number;
  attack: number; // 총공격력 또는 총마력
  damageBossSum: number;
  ignoreDef: number; // 실방무 %
  critRate: number; critDamage: number; finalDamage: number;
}

// ── 옵션 텍스트 파서 ────────────────────────────────────────────────
// "몬스터 방어율 무시 +40%", "공격력 +9%", "STR, DEX +36" 같은 개별 옵션 문구 하나를 누적한다.
// 원본 응답(tooltip entries[].text, 오픈API potential_option_N)이 이미 옵션 1줄 단위라 그대로 넣는다.

interface RawOpts {
  str: number; dex: number; int: number; luk: number; hp: number; allStat: number;
  strPct: number; dexPct: number; intPct: number; lukPct: number; allPct: number; hpPct: number;
  atk: number; matk: number; atkPct: number; matkPct: number;
  dmg: number; boss: number; ida: number[]; critDmg: number; finalDmg: number;
}

function emptyRaw(): RawOpts {
  return { str: 0, dex: 0, int: 0, luk: 0, hp: 0, allStat: 0, strPct: 0, dexPct: 0, intPct: 0, lukPct: 0, allPct: 0, hpPct: 0,
    atk: 0, matk: 0, atkPct: 0, matkPct: 0, dmg: 0, boss: 0, ida: [], critDmg: 0, finalDmg: 0 };
}

const OPT_RE = /^(.+?)\s*\+\s*(-?\d+(?:\.\d+)?)\s*(%?)$/;

function accumOpt(raw: RawOpts, seg: string | null | undefined) {
  if (!seg) return;
  const m = seg.trim().match(OPT_RE);
  if (!m) return;
  const val = Number(m[2]);
  const pct = m[3] === '%';
  for (const one of m[1].split(',').map((s) => s.trim())) {
    switch (one) {
      case 'STR': pct ? (raw.strPct += val) : (raw.str += val); break;
      case 'DEX': pct ? (raw.dexPct += val) : (raw.dex += val); break;
      case 'INT': pct ? (raw.intPct += val) : (raw.int += val); break;
      case 'LUK': pct ? (raw.lukPct += val) : (raw.luk += val); break;
      case '올스탯': pct ? (raw.allPct += val) : (raw.allStat += val); break;
      case '최대 HP': pct ? (raw.hpPct += val) : (raw.hp += val); break;
      case '공격력': pct ? (raw.atkPct += val) : (raw.atk += val); break;
      case '마력': pct ? (raw.matkPct += val) : (raw.matk += val); break;
      case '데미지': if (pct) raw.dmg += val; break;
      case '보스 몬스터 데미지':
      case '보스 데미지': if (pct) raw.boss += val; break;
      case '몬스터 방어율 무시': if (pct) raw.ida.push(val); break;
      case '크리티컬 데미지': if (pct) raw.critDmg += val; break;
      case '최종 데미지': if (pct) raw.finalDmg += val; break;
      default: break; // 환산 무관(크확·상태이상내성 등)
    }
  }
}

// 빈 기여 (해당 부위에 현재 장비가 없을 때의 비교 기준 = 순수 추가).
export const EMPTY_CONTRIBUTION: Contribution = {
  str: 0, dex: 0, int: 0, luk: 0, hp: 0, allStat: 0,
  strPct: 0, dexPct: 0, intPct: 0, lukPct: 0, allPct: 0, hpPct: 0,
  atk: 0, matk: 0, atkPct: 0, matkPct: 0, dmgBoss: 0, idaFactor: 1, critDmg: 0, finalDmg: 0,
};

function toContribution(raw: RawOpts): Contribution {
  return {
    str: raw.str, dex: raw.dex, int: raw.int, luk: raw.luk, hp: raw.hp, allStat: raw.allStat,
    strPct: raw.strPct, dexPct: raw.dexPct, intPct: raw.intPct, lukPct: raw.lukPct, allPct: raw.allPct, hpPct: raw.hpPct,
    atk: raw.atk, matk: raw.matk, atkPct: raw.atkPct, matkPct: raw.matkPct,
    dmgBoss: raw.dmg + raw.boss,
    idaFactor: raw.ida.reduce((f, v) => f * (1 - v / 100), 1),
    critDmg: raw.critDmg, finalDmg: raw.finalDmg,
  };
}

// 경매장 매물 원본(toolTip.stat 수치 + upgradeInfo.potential/additionalPotential.entries[].text) → Contribution.
// stat은 고정옵션+추옵+스포+주문서 합산 수치. 잠재/에디 %는 entries 텍스트에만 있어 함께 파싱(중복 없음).
export function contributionFromRawItem(item: any): Contribution {
  const raw = emptyRaw();
  const tt = item?.toolTip ?? {};
  const fs = tt.stat ?? {};
  raw.str = fs.str ?? 0; raw.dex = fs.dex ?? 0; raw.int = fs.int ?? 0; raw.luk = fs.luk ?? 0;
  raw.hp = fs.mhp ?? 0; raw.allPct = fs.all ?? 0; // stat.all = 올스탯%
  raw.atk = fs.pad ?? 0; raw.matk = fs.mad ?? 0;
  raw.dmg = fs.dam ?? 0; raw.boss = fs.bdr ?? 0;
  if (fs.imdr) raw.ida.push(fs.imdr); // 고정+추옵 방무
  const ui = tt.upgradeInfo ?? {};
  for (const e of ui.potential?.entries ?? []) accumOpt(raw, e.text);
  for (const e of ui.additionalPotential?.entries ?? []) accumOpt(raw, e.text);
  return toContribution(raw);
}

// 넥슨 오픈 API item-equipment 아이템 → Contribution (현재 장비).
export function contributionFromEquip(equip: any): Contribution {
  const raw = emptyRaw();
  const t = equip.item_total_option ?? {};
  raw.str = Number(t.str ?? 0); raw.dex = Number(t.dex ?? 0); raw.int = Number(t.int ?? 0); raw.luk = Number(t.luk ?? 0);
  raw.hp = Number(t.max_hp ?? 0); raw.allPct = Number(t.all_stat ?? 0);
  raw.atk = Number(t.attack_power ?? 0); raw.matk = Number(t.magic_power ?? 0);
  raw.dmg = Number(t.damage ?? 0); raw.boss = Number(t.boss_damage ?? 0);
  const ida = Number(t.ignore_monster_armor ?? 0);
  if (ida) raw.ida.push(ida);
  for (const k of ['potential_option_1', 'potential_option_2', 'potential_option_3',
    'additional_option_1', 'additional_option_2', 'additional_option_3']) {
    accumOpt(raw, equip[k]);
  }
  return toContribution(raw);
}

// ── 데미지 배수 D ─────────────────────────────────────────────────

// StatFactor(스탯 항). 모델별 계산. 반환 항상 양수 근처.
function statFactor(s: CharState): number {
  switch (s.model.kind) {
    case 'xenon':
      return 4 * (s.str + s.dex + s.luk);
    case 'hp': {
      const pure = 545 + s.level * 90;
      return 4 * (pure / 14 + Math.max(0, s.hp - pure) / 17.5);
    }
    default: {
      const val: Record<string, number> = { STR: s.str, DEX: s.dex, INT: s.int, LUK: s.luk };
      return 4 * val[s.model.main] + val[s.model.sub];
    }
  }
}

function critFactor(critRate: number, critDamage: number): number {
  const p = Math.min(1, critRate / 100);
  return p * (0.35 + critDamage / 100) + 1;
}

export function damageMultiplier(s: CharState): number {
  const dmgFactor = 1 + s.damageBossSum / 100;
  const defFactor = Math.max(0, 1 - (BOSS_DEFENSE / 100) * (1 - s.ignoreDef / 100));
  const finalFactor = 1 + s.finalDamage / 100;
  return statFactor(s) * s.attack * dmgFactor * critFactor(s.critRate, s.critDamage) * defFactor * finalFactor;
}

// 한 스탯의 교체 후 최종값: 수치 교체 + %는 최종총합 기준 근사 가산.
function swapStat(base: number, curNum: number, curPct: number, candNum: number, candPct: number): number {
  return base - curNum - base * (curPct / 100) + candNum + base * (candPct / 100);
}

// 현재 장비(cur)를 candidate로 교체한 새 상태. isMagic 여부는 attack에 이미 반영돼 있으므로
// 공격력/마력 중 해당하는 쪽만 델타로 적용한다.
function swapState(s: CharState, cur: Contribution, cand: Contribution, isMagic: boolean): CharState {
  const curNoWeaponFactor = (1 - s.ignoreDef / 100) / (cur.idaFactor || 1);
  const newIgnore = 100 * (1 - curNoWeaponFactor * cand.idaFactor);
  const atkNum = (c: Contribution) => (isMagic ? c.matk : c.atk);
  const atkPct = (c: Contribution) => (isMagic ? c.matkPct : c.atkPct);
  return {
    model: s.model,
    level: s.level,
    str: swapStat(s.str, cur.str + cur.allStat, cur.strPct + cur.allPct, cand.str + cand.allStat, cand.strPct + cand.allPct),
    dex: swapStat(s.dex, cur.dex + cur.allStat, cur.dexPct + cur.allPct, cand.dex + cand.allStat, cand.dexPct + cand.allPct),
    int: swapStat(s.int, cur.int + cur.allStat, cur.intPct + cur.allPct, cand.int + cand.allStat, cand.intPct + cand.allPct),
    luk: swapStat(s.luk, cur.luk + cur.allStat, cur.lukPct + cur.allPct, cand.luk + cand.allStat, cand.lukPct + cand.allPct),
    hp: swapStat(s.hp, cur.hp, cur.hpPct, cand.hp, cand.hpPct),
    attack: swapStat(s.attack, atkNum(cur), atkPct(cur), atkNum(cand), atkPct(cand)),
    damageBossSum: s.damageBossSum - cur.dmgBoss + cand.dmgBoss,
    ignoreDef: newIgnore,
    critRate: s.critRate,
    critDamage: s.critDamage - cur.critDmg + cand.critDmg,
    finalDamage: s.finalDamage - cur.finalDmg + cand.finalDmg,
  };
}

// Δ환산: 현재 장비(cur)를 candidate로 교체 시 오르는 환산 주스탯. 음수면 하락.
export function hwansanDiff(s: CharState, cur: Contribution, cand: Contribution, isMagic: boolean): number {
  const before = damageMultiplier(s);
  if (before <= 0) return 0;
  const after = damageMultiplier(swapState(s, cur, cand, isMagic));
  return ((after / before - 1) * statFactor(s)) / 4;
}
