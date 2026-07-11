// 넥슨 오픈 API 응답 → UserStat 누적. 소스별 콜렉터를 순서대로 호출한다.
// 1차 목표는 "다 모으기". 스탯% 적용 여부(심볼/유니온이 flat vs flatNoPct)는 재구성 검증에서 확정한다.
import type { UserStat } from './statSheet.js';
import { apply, accumPlus, accumIncrease } from './parse.js';

const num = (v: unknown) => Number(v ?? 0) || 0;

// ── 장비 1개 (item-equipment[]의 한 항목) ──────────────────────────
// item_total_option = 고정옵션+추옵+주문서+스타포스 (잠재 제외). 잠재/에디는 텍스트에 별도 → 중복 없음.
// level: 잠재 "캐릭터 기준 N레벨 당 STAT +M" 라인 환산용 캐릭터 레벨 (floor(level/N)×M).
const RE_PER_LEVEL = /캐릭터 기준\s*(\d+)레벨 당\s*(.+?)\s*\+\s*(\d+(?:\.\d+)?)/;
export function collectGearItem(us: UserStat, item: any, level = 0): void {
  const t = item?.item_total_option ?? {};
  us.flat.STR += num(t.str); us.flat.DEX += num(t.dex); us.flat.INT += num(t.int); us.flat.LUK += num(t.luk);
  us.allPct += num(t.all_stat); // item_total_option.all_stat(추옵 올스탯)은 %다 (flat 아님)
  us.hpFlat += num(t.max_hp);
  us.atk += num(t.attack_power); us.matk += num(t.magic_power);
  us.bossDmg += num(t.boss_damage);   // 수치로 오지만 의미는 %
  us.damage += num(t.damage);
  if (num(t.ignore_monster_armor)) us.ignoreDef.push(num(t.ignore_monster_armor));
  // 잠재 3줄 + 에디 3줄 (텍스트: 깡·% 모두 accumPlus가 처리, 레벨 비례 라인은 별도 환산)
  for (const k of ['potential_option_1', 'potential_option_2', 'potential_option_3',
    'additional_potential_option_1', 'additional_potential_option_2', 'additional_potential_option_3']) {
    const line = item?.[k];
    const per = typeof line === 'string' ? line.match(RE_PER_LEVEL) : null;
    if (per) apply(us, per[2], Math.floor(level / Number(per[1])) * Number(per[3]), false);
    else accumPlus(us, line);
  }
  // 무기 소울 옵션 ("보스 몬스터 데미지 +7%" 류) — 넥슨 resting 포함 (오유찬 보공 잔차 7 정확 일치)
  accumPlus(us, item?.soul_option);
}

export function collectGear(us: UserStat, itemEquipment: any[] | undefined, level = 0): void {
  for (const it of itemEquipment ?? []) collectGearItem(us, it, level);
}

// ── 세트효과 (set-effect[]) ────────────────────────────────────────
// 세트효과는 누적: total_set_count 이하 모든 티어의 옵션이 동시 적용. set_option_full의 각 티어 텍스트를 파싱.
export function collectSet(us: UserStat, setEffect: any[] | undefined): void {
  for (const s of setEffect ?? []) {
    const count = num(s.total_set_count);
    for (const tier of s.set_option_full ?? []) {
      if (num(tier.set_count) <= count) accumPlus(us, tier.set_option);
    }
  }
}

// ── 심볼 (symbol-equipment의 symbol[]) ─────────────────────────────
// 아케인/어센틱 심볼 깡 주스탯은 스탯%(주스탯%)를 받지 않고 최종에 그대로 가산 → flatNoPct.
// 실측 재구성으로 확인: 심볼을 flat(스탯% 적용)에 넣으면 LUK가 약 2배로 튄다.
export function collectSymbol(us: UserStat, symbols: any[] | undefined): void {
  for (const s of symbols ?? []) {
    us.flatNoPct.STR += num(s.symbol_str); us.flatNoPct.DEX += num(s.symbol_dex);
    us.flatNoPct.INT += num(s.symbol_int); us.flatNoPct.LUK += num(s.symbol_luk);
    us.hpFlatNoPct += num(s.symbol_hp);
  }
}

// ── 하이퍼스탯 (hyper-stat의 hyper_stat_preset_N) ──────────────────
// stat_increase 텍스트("운 180 증가", "크리티컬 데미지 10% 증가"). 깡 주스탯은 스탯% 안 받음 → noPct.
export function collectHyper(us: UserStat, preset: any[] | undefined): void {
  for (const h of preset ?? []) accumIncrease(us, h.stat_increase, true);
}

// ── 어빌리티 (ability의 ability_info[]) ────────────────────────────
// ability_value 텍스트. 대부분 데미지/크확 계열(조건부 포함) — 일단 무조건형만 파서가 잡는다.
export function collectAbility(us: UserStat, abilityInfo: any[] | undefined): void {
  for (const a of abilityInfo ?? []) accumIncrease(us, a.ability_value);
}

// ── 메이플 용사(메용) ──────────────────────────────────────────────
// "직접 찍은(AP 배분) 스탯의 N%"만큼을 깡 스탯으로 올려주는 상시 스킬. 넥슨 resting에 포함 + 스탯% 적용 → flat.
// N%는 스킬에서 파싱한다(직업마다 이름 상이: 메이플 용사/노바의 용사 등, 4차). 하드코딩 금지.
// 스킬 효과 패턴: "[패시브 효과 : AP를 직접 투자한 모든 능력치 15% 증가]". "직접 찍은 스탯"=final_stat "AP 배분 X".
export function collectMapleWarrior(us: UserStat, statMap: Record<string, number>, skills: Record<string, { skill_effect?: string }[]>): void {
  let pct = 0;
  for (const arr of Object.values(skills)) {
    for (const s of arr) {
      const m = String(s.skill_effect ?? '').match(/AP를 직접 투자한 모든 능력치\s*(\d+(?:\.\d+)?)\s*%/);
      if (m) { pct = Number(m[1]); break; }
    }
    if (pct) break;
  }
  const f = pct / 100;
  us.flat.STR += Math.floor((statMap['AP 배분 STR'] ?? 0) * f);
  us.flat.DEX += Math.floor((statMap['AP 배분 DEX'] ?? 0) * f);
  us.flat.INT += Math.floor((statMap['AP 배분 INT'] ?? 0) * f);
  us.flat.LUK += Math.floor((statMap['AP 배분 LUK'] ?? 0) * f);
}

// ── 베이스/AP 주스탯 (stat의 final_stat 맵) ────────────────────────
// "AP 배분 LUK" = 유저가 찍은 AP. 캐릭터 순수 주스탯의 근간(스탯% 적용 대상) → flat.
// 이름표: statMap['AP 배분 LUK'] 등. 직업 이니셜 +4 등 잔여는 재구성 검증에서 확인.
export function collectBaseAP(us: UserStat, statMap: Record<string, number>): void {
  us.flat.STR += statMap['AP 배분 STR'] ?? 0;
  us.flat.DEX += statMap['AP 배분 DEX'] ?? 0;
  us.flat.INT += statMap['AP 배분 INT'] ?? 0;
  us.flat.LUK += statMap['AP 배분 LUK'] ?? 0;
}

// ── 칭호 (item-equipment 응답의 title 필드) ────────────────────────
// title_description에 "STR +N, 올스탯 +M, 공격력 +K%" 류로 스탯이 붙는다. 추가 호출 없음(장비 응답에 포함).
export function collectTitle(us: UserStat, equip: any): void {
  const desc = equip?.title?.title_description;
  if (typeof desc === 'string') for (const line of desc.split(/[,\n]/)) accumPlus(us, line);
}

// ── 유니온 (/user/union-raider) ────────────────────────────────────
// 공격대원효과(union_raider_stat): 깡 주스탯이 스탯% 안 받음 → noPct.
// 점령효과(union_occupied_stat): 스탯% 받음 → flat.
// 전투 스탯(union_state_stat, 신규): 주스탯 깡이 스탯% 받는 것으로 가정(scouter abs 대조와 일치) → flat. 잔차로 검증.
export function collectUnion(us: UserStat, raider: any): void {
  for (const line of raider?.union_raider_stat ?? []) accumIncrease(us, line, true);
  for (const line of raider?.union_occupied_stat ?? []) accumIncrease(us, line, false);
  for (const line of raider?.union_state_stat ?? []) accumIncrease(us, line, false);
}

// ── 유니온 아티팩트 (/user/union-artifact) ─────────────────────────
// union_artifact_effect[].name = "올스탯 150 증가" 류 텍스트. 주스탯/올스탯 깡은 스탯% 받는 것으로 가정 → flat.
export function collectArtifact(us: UserStat, artifact: any): void {
  for (const e of artifact?.union_artifact_effect ?? []) accumIncrease(us, e?.name, false);
}

// ── 유니온 챔피언 뱃지 (/user/union-champion) ──────────────────────
// champion_badge_total_info[].stat = "올스탯 100, 최대 HP/MP 5000 증가" 류 — 상시 패시브, 넥슨 resting 포함
// (티엘 실측: 보공 25가 잔차와 정확히 일치). 올스탯은 스탯% 받는 flat으로 가정.
// 챔피언의 가호(코인 소모 30분 버프)는 별개 — 수치가 API에 없어 미수집(잔차로 추적 중).
export function collectChampion(us: UserStat, champion: any): void {
  for (const e of champion?.champion_badge_total_info ?? []) accumIncrease(us, e?.stat, false);
}

// ── 성향 (/character/propensity) ───────────────────────────────────
// 카리스마 → 몬스터 방어율 무시(100렙 10%): 넥슨 방무 필드에 포함 (오유찬 방무 잔차 0 실측).
// 통찰력 → 크확은 수집하지 않는다 — 오유찬 실측에서 넥슨 크확 필드에 미포함(넣으면 +10 초과, 빼면 정확).
// (의지=HP·상태이상내성, 감성=버프지속 등은 데미지 무관이라 생략 — 데벤 HP 계산 붙일 때 의지 추가.)
export function collectPropensity(us: UserStat, propensity: any): void {
  const charisma = num(propensity?.charisma_level);
  if (charisma) us.ignoreDef.push(charisma * 0.1);
}
