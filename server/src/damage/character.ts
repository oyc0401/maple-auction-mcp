// 넥슨 RawBundle → CharacterStats(stat-interface) 조립 — 소스별 StatBlock의 단일 진실 원천.
// 수집 파서(collect/linkSkill/skillPassive/hexaStat)는 UserStat 버킷 뮤테이터라 blockOf로 소스 단위 블록을 뽑는다.
// combat=true면 조건부(cond) 링크·버프 스킬을 포함해 전투 기준으로 조립한다 (resting 재구성 검증은 false).
import type { MainStat } from './statSheet.js';
import type { StatBlock, CharacterStats } from './stat-interface.js';
import type { RawBundle } from './nexon.js';
import { blockOf, isEmptyBlock, MAIN } from './block.js';
import {
  collectGearItem, collectSet, collectSymbol, collectHyper, collectAbility, collectBaseAP,
  collectUnion, collectArtifact, collectChampion, collectPropensity, collectTitle,
  collectChallenger, collectBurning, hasBurning, BURNING_TOOLTIP,
} from './collect.js';
import { collectLinkSkills } from './linkSkill.js';
import { collectSkillPassive, type SkillsByGrade } from './skillPassive.js';
import { collectHexaStat } from './hexaStat.js';

export function statMapOf(finalStat: { stat_name: string; stat_value: string }[] | undefined): Record<string, number> {
  const m: Record<string, number> = {};
  for (const s of finalStat ?? []) m[s.stat_name] = Number(s.stat_value);
  return m;
}

export function mainStatKeyOf(m: Record<string, number>): MainStat {
  return MAIN.reduce((a, b) => ((m[b] ?? 0) >= (m[a] ?? 0) ? b : a), 'LUK' as MainStat);
}

// 넥슨 슬롯명 → GearStats 키 (공백 제거 표기)
export const SLOT_KEY: Record<string, string> = { '포켓 아이템': '포켓아이템', '기계 심장': '기계심장' };

const POTENTIAL_KEYS = [
  'potential_option_1', 'potential_option_2', 'potential_option_3',
  'additional_potential_option_1', 'additional_potential_option_2', 'additional_potential_option_3',
];
// 잠재 "캐릭터 기준 N레벨 당 X +M"은 인터페이스 규약(9레벨 주기)대로 레벨당X=M으로 보존.
// 9레벨이 아닌 주기는 인터페이스에 자리가 없어 깡으로 환산해 넣고 노트를 남긴다.
const RE_PER_LEVEL = /캐릭터 기준\s*(\d+)레벨 당\s*(.+?)\s*\+\s*(\d+(?:\.\d+)?)/;
const STAT_ALIAS: Record<string, MainStat> = {
  STR: 'STR', DEX: 'DEX', INT: 'INT', LUK: 'LUK',
  힘: 'STR', 민첩: 'DEX', 지력: 'INT', 운: 'LUK', 민첩성: 'DEX', 지능: 'INT', 행운: 'LUK',
};

export interface BuiltCharacter { stats: CharacterStats; notes: string[] }

export function buildCharacterStats(bundle: RawBundle, combat = false): BuiltCharacter {
  const notes: string[] = [];
  const statMap = statMapOf(bundle.stat?.final_stat);
  const level = Number(bundle.basic?.character_level ?? 0);
  const cls: string = bundle.stat?.character_class ?? bundle.basic?.character_class ?? '';
  const mainKey = mainStatKeyOf(statMap);

  // ── 장비 (부위별) ─────────────────────────────────────────────────
  const gear: Record<string, StatBlock> = {};
  for (const it of bundle.equip?.item_equipment ?? []) {
    const b = blockOf((u) => collectGearItem(u, it, 0)) as Record<string, number | number[]>; // level 0 → 레벨당 라인 기여 0
    for (const k of POTENTIAL_KEYS) {
      const per = typeof it[k] === 'string' ? it[k].match(RE_PER_LEVEL) : null;
      if (!per) continue;
      const main = STAT_ALIAS[per[2].trim()];
      if (Number(per[1]) === 9 && main) {
        b[`레벨당${main}`] = ((b[`레벨당${main}`] as number) ?? 0) + Number(per[3]);
      } else if (main) {
        notes.push(`${it.item_equipment_slot}: ${per[1]}레벨 당 라인 — 깡으로 환산`);
        b[main] = ((b[main] as number) ?? 0) + Math.floor(level / Number(per[1])) * Number(per[3]);
      }
    }
    if (Object.keys(b).length === 0) continue;
    const slot = SLOT_KEY[it.item_equipment_slot] ?? it.item_equipment_slot;
    if (gear[slot]) notes.push(`슬롯 중복: ${slot}`);
    gear[slot] = b as StatBlock;
  }
  const title = blockOf((u) => collectTitle(u, bundle.equip));
  if (!isEmptyBlock(title)) gear['칭호'] = title;

  // ── 세트효과 (세트별) ─────────────────────────────────────────────
  const sets: Record<string, StatBlock> = {};
  for (const s of bundle.setEff?.set_effect ?? []) {
    const b = blockOf((u) => collectSet(u, [s]));
    if (!isEmptyBlock(b)) sets[s.set_name] = b;
  }

  // ── 메이플 용사(메용): AP 직접투자 스탯 N% — N만 저장 (환산은 flattenStats) ──
  // 상시 스킬. 넥슨 resting에 포함 + 스탯% 적용 → flat. N%는 스킬에서 파싱(직업마다 이름 상이:
  // 메이플 용사/노바의 용사 등, 4차). 하드코딩 금지. 패턴: "[패시브 효과 : AP를 직접 투자한 모든 능력치 15% 증가]".
  let mwPct = 0;
  for (const arr of Object.values(bundle.skills ?? {})) {
    for (const s of arr) {
      const m = String(s.skill_effect ?? '').match(/AP를 직접 투자한 모든 능력치\s*(\d+(?:\.\d+)?)\s*%/);
      if (m) { mwPct = Number(m[1]); break; }
    }
    if (mwPct) break;
  }

  // ── 링크 스킬 (스킬별) ────────────────────────────────────────────
  const links: Record<string, StatBlock> = {};
  {
    const transferred = bundle.link?.character_link_skill ?? bundle.link?.character_link_skill_info ?? [];
    const owned = bundle.link?.character_owned_link_skill;
    for (const s of [...transferred, ...(owned ? [owned].flat() : [])]) {
      const b = blockOf((u) => collectLinkSkills(u, { character_link_skill: [s] }, combat));
      if (isEmptyBlock(b)) continue;
      const key = String(s.skill_name ?? '').replace(/\([^)]*\)\s*$/, '').trim(); // 본인 링크 "(직업)" 접미사 제거
      links[key] = b;
    }
  }

  // ── 직업/공통 스킬 패시브 (차수별·스킬별) ─────────────────────────
  // 쓸만한 게이팅은 룰 적용만 막고 5차 브래킷 패시브는 유지해야 하므로, 여기서 스킬을 미리 거르지 않고
  // 전체 보유 목록을 주입해 collectSkillPassive 내부에서 게이팅한다.
  const ownedAll = new Set<string>();
  for (const arr of Object.values(bundle.skills ?? {})) for (const s of arr) ownedAll.add(s.skill_name);
  const skillsByGrade: Record<string, Record<string, StatBlock>> = {};
  for (const grade of ['0', '1', '2', '3', '4', '5']) {
    for (const s of bundle.skills?.[grade] ?? []) {
      const b = blockOf((u) => collectSkillPassive(u, cls, { [grade]: [s] } as SkillsByGrade, combat, ownedAll));
      if (isEmptyBlock(b)) continue;
      (skillsByGrade[grade] ??= {})[s.skill_name] = b;
    }
  }

  // ── 단일 블록 소스들 ──────────────────────────────────────────────
  const preset = bundle.hyper?.[`hyper_stat_preset_${bundle.hyper?.use_preset_no ?? 1}`];
  const single = {
    심볼: blockOf((u) => bundle.symbol && collectSymbol(u, bundle.symbol.symbol)),
    하이퍼스탯: blockOf((u) => collectHyper(u, preset)),
    어빌리티: blockOf((u) => bundle.ability && collectAbility(u, bundle.ability.ability_info)),
    유니온: blockOf((u) => bundle.union && collectUnion(u, bundle.union)),
    아티팩트: blockOf((u) => bundle.artifact && collectArtifact(u, bundle.artifact)),
    챔피언: blockOf((u) => bundle.champion && collectChampion(u, bundle.champion)),
    성향: blockOf((u) => bundle.propensity && collectPropensity(u, bundle.propensity)),
    헥사스탯: blockOf((u) => bundle.hexa && collectHexaStat(u, bundle.hexa, mainKey, mainKey === 'INT', cls === '제논' ? 'xenon' : cls === '데몬어벤져' ? 'deven' : 'normal')),
    챌린저스: blockOf((u) => bundle.basic?.world_name === '챌린저스' && collectChallenger(u)),
    버닝: blockOf((u) => hasBurning(bundle.skills) && collectBurning(u, BURNING_TOOLTIP)),
  };

  // ── CharacterStats 조립 (인터페이스 필드 순서대로, 빈 소스는 생략) ──
  // 모든 캐릭터 공통 베이스(크확 5%, 크뎀 35%)는 기본 블록에 담는다. 넥슨 API의 크리티컬 확률 필드는
  // 이 베이스를 포함하지만 크리티컬 데미지 필드는 포함하지 않으므로, 재구성 대조는 크뎀만 기본 블록
  // 몫을 제외하고 비교한다(cli.ts).
  const out: CharacterStats = { 기본: { 크확: 5, 크뎀: 35 }, AP: blockOf((u) => collectBaseAP(u, statMap)) };
  if (mwPct) out.메이플용사 = mwPct;
  // 크리티컬 리인포스(5차 공용)는 크확의 50%를 크뎀으로 전환한다. 여기서는 보유 여부만 기록하고
  // 전환 계산은 combat.ts가 D 계산의 마지막 단계에서 한다.
  if ((bundle.skills?.['5'] ?? []).some((s) => s.skill_name === '크리티컬 리인포스')) out.크리티컬리인포스 = 50;
  if (Object.keys(gear).length) out.장비 = gear;
  if (Object.keys(sets).length) out.세트효과 = sets;
  for (const k of ['심볼', '하이퍼스탯', '어빌리티', '유니온', '아티팩트', '챔피언', '성향'] as const) {
    if (!isEmptyBlock(single[k])) out[k] = single[k];
  }
  for (const [grade, rec] of Object.entries(skillsByGrade)) (out as any)[`스킬_${grade}차`] = rec;
  if (Object.keys(links).length) out.링크스킬 = links;
  if (!isEmptyBlock(single.헥사스탯)) out.헥사스탯 = single.헥사스탯;
  if (!isEmptyBlock(single.챌린저스)) out.챌린저스 = single.챌린저스;
  if (!isEmptyBlock(single.버닝)) out.버닝 = single.버닝;
  return { stats: out, notes };
}
