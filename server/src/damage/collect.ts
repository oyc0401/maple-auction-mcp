// 넥슨 오픈 API 응답 → UserStat 누적. 소스별 콜렉터를 순서대로 호출한다.
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
  // 무기 소울 옵션 ("보스 몬스터 데미지 +7%" 류)
  accumPlus(us, item?.soul_option);
}

// ── 세트효과 (set-effect[]) ────────────────────────────────────────
// 세트효과는 누적: total_set_count 이하 모든 티어의 옵션이 동시 적용. set_option_full의 각 티어 텍스트를 파싱.
// ⚠️ 일부 세트는 넥슨 API가 실제 인게임 최대 세트수보다 큰 "팬텀 티어"를 포함한다(도전자의 장비 세트는
//   방어구7+무기1=8을 세지만 인게임 최대는 7). 알려진 세트는 최대 세트수로 캡한다.
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

// ── 심볼 (symbol-equipment의 symbol[]) ─────────────────────────────
// 아케인/어센틱 심볼 깡 주스탯은 스탯%(주스탯%)를 받지 않고 최종에 그대로 가산 → flatNoPct.
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
// ability_value 텍스트. 대부분 데미지/크확 계열.
export function collectAbility(us: UserStat, abilityInfo: any[] | undefined): void {
  for (const a of abilityInfo ?? []) accumIncrease(us, a.ability_value);
}

// ── 베이스/AP 주스탯 (stat의 final_stat 맵) ────────────────────────
// "AP 배분 LUK" = 유저가 찍은 AP. 캐릭터 순수 주스탯의 근간(스탯% 적용 대상) → flat.
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
// 점령효과(union_occupied_stat)·전투 스탯(union_state_stat): 스탯% 받음 → flat.
export function collectUnion(us: UserStat, raider: any): void {
  for (const line of raider?.union_raider_stat ?? []) accumIncrease(us, line, true);
  for (const line of raider?.union_occupied_stat ?? []) accumIncrease(us, line, false);
  for (const line of raider?.union_state_stat ?? []) accumIncrease(us, line, false);
}

// ── 유니온 아티팩트 (/user/union-artifact) ─────────────────────────
// union_artifact_effect[].name = "올스탯 150 증가" 류 텍스트. 주스탯/올스탯 깡은 스탯% 받음 → flat.
export function collectArtifact(us: UserStat, artifact: any): void {
  for (const e of artifact?.union_artifact_effect ?? []) accumIncrease(us, e?.name, false);
}

// ── 유니온 챔피언 뱃지 (/user/union-champion) ──────────────────────
// champion_badge_total_info[].stat = "올스탯 100, 최대 HP/MP 5000 증가" 류 — 상시 패시브. 올스탯은 flat.
// 챔피언의 가호(코인 소모 30분 버프)는 수치가 API에 없어 미수집.
export function collectChampion(us: UserStat, champion: any): void {
  for (const e of champion?.champion_badge_total_info ?? []) accumIncrease(us, e?.stat, false);
}

// ── 성향 (/character/propensity) ───────────────────────────────────
// 카리스마 → 몬스터 방어율 무시(100렙 10%). 통찰력→크확은 넥슨 크확 필드에 이미 포함돼 있어 중복 수집하지 않는다.
export function collectPropensity(us: UserStat, propensity: any): void {
  const charisma = num(propensity?.charisma_level);
  if (charisma) us.ignoreDef.push(charisma * 0.1);
}

// ── 챌린저스 서버 상시 버프 (모든 챌린저스 캐릭터 고정) ────────
// 넥슨 API에 개별 항목이 없어 인게임 버프 툴팁 값을 하드코딩한다. 올스탯은 flat(allFlat).
export function collectChallenger(us: UserStat): void {
  us.allFlat += 100;
  us.atk += 80;
  us.matk += 80;
  us.bossDmg += 70;
  us.ignoreDef.push(70);
  us.critRate += 30;
  us.critDmg += 40;
}

// ── 버닝 BEYOND / 하이퍼 버닝 MAX 이벤트 버프 ─────────────────────────────────
// 효과가 스킬창에 표시되지 않아 /skill API에 수치가 없으므로 인게임 버프 툴팁 값을 하드코딩한다(두 스킬 동일).
// 스킬 보유 여부(hasBurning)로만 게이팅한다 — 이벤트 개편 시 갱신 필요.
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

// ── 캐시장비 (/character/cashitem-equipment) ───────────────────────
// 하이퍼 버닝 이벤트 치장 세트 등 "능력치 있는 캐시장비"의 주스탯·공마를 실제 전투 스탯으로 반영.
// cash_item_option[].option_type/option_value. 주스탯은 flat(×주스탯%)로 가정 — 잔차로 검증(꽈숩노 0).
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

// ── 길드 스킬 (/guild/basic) ───────────────────────────────────────
// "길드의 노하우" 등 지속시간 없는 상시 패시브의 공/마·보공 등만 반영한다.
// "N분/초 동안" 지속버프(보스 킬링 머신·길드의 이름으로·크게 한방)는 액티브라 제외.
// 일반 몬스터 데미지는 보스전 무관 → 제외. (꽈숩노 실측: 노하우 I/II/IV/VI 합 = 공/마 45)
export function collectGuild(us: UserStat, guild: any): void {
  const skills = [...(guild?.guild_skill ?? []), ...(guild?.guild_noblesse_skill ?? [])];
  for (const s of skills) {
    const eff = String(s?.skill_effect ?? '');
    if (/\d+\s*(분|초)\s*동안/.test(eff)) continue; // 지속시간 있는 액티브 버프 제외
    for (const line of eff.split('\n')) { // 줄 단위. 콤마 결합("공격력 30, 마력 30 증가")은 accumIncrease가 처리.
      if (line.includes('일반 몬스터') || line.includes('받는 피해')) continue; // 보스 무관/미모델
      accumIncrease(us, line);
    }
  }
}
