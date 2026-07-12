import type { MainStat } from './statSheet.js';
import type { StatBlock, CharacterStats } from './stat-interface.js';
import type { RawBundle } from './nexon.js';
import { blockOf, isEmptyBlock, MAIN } from './block.js';
import {
  collectGearItem, collectSet, collectSymbol, collectHyper, collectAbility, collectBaseAP,
  collectUnion, collectArtifact, collectChampion, collectPropensity, collectTitle,
  collectChallenger, collectBurning, hasBurning, BURNING_TOOLTIP, collectGuild, collectCash,
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

export const SLOT_KEY: Record<string, string> = { '포켓 아이템': '포켓아이템', '기계 심장': '기계심장' };

const POTENTIAL_KEYS = [
  'potential_option_1', 'potential_option_2', 'potential_option_3',
  'additional_potential_option_1', 'additional_potential_option_2', 'additional_potential_option_3',
];
const RE_PER_LEVEL = /캐릭터 기준\s*(\d+)레벨 당\s*(.+?)\s*\+\s*(\d+(?:\.\d+)?)/;
const STAT_ALIAS: Record<string, MainStat> = {
  STR: 'STR', DEX: 'DEX', INT: 'INT', LUK: 'LUK',
  힘: 'STR', 민첩: 'DEX', 지력: 'INT', 운: 'LUK', 민첩성: 'DEX', 지능: 'INT', 행운: 'LUK',
};

export interface BuiltCharacter { stats: CharacterStats; notes: string[] }

export function buildCharacterStats(bundle: RawBundle): BuiltCharacter {
  const notes: string[] = [];
  const statMap = statMapOf(bundle.stat?.final_stat);
  const level = Number(bundle.basic?.character_level ?? 0);
  const cls: string = bundle.stat?.character_class ?? bundle.basic?.character_class ?? '';
  const mainKey = mainStatKeyOf(statMap);

  const gear: Record<string, StatBlock> = {};
  for (const it of bundle.equip?.item_equipment ?? []) {
    const b = blockOf((u) => collectGearItem(u, it, 0)) as Record<string, number | number[]>;
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

  const sets: Record<string, StatBlock> = {};
  for (const s of bundle.setEff?.set_effect ?? []) {
    const b = blockOf((u) => collectSet(u, [s]));
    if (!isEmptyBlock(b)) sets[s.set_name] = b;
  }

  let mwPct = 0;
  for (const arr of Object.values(bundle.skills ?? {})) {
    for (const s of arr) {
      const m = String(s.skill_effect ?? '').match(/AP를 직접 투자한 모든 능력치\s*(\d+(?:\.\d+)?)\s*%/);
      if (m) { mwPct = Number(m[1]); break; }
    }
    if (mwPct) break;
  }

  const links: Record<string, StatBlock> = {};
  {
    const transferred = bundle.link?.character_link_skill ?? bundle.link?.character_link_skill_info ?? [];
    const owned = bundle.link?.character_owned_link_skill;
    for (const s of [...transferred, ...(owned ? [owned].flat() : [])]) {
      const b = blockOf((u) => collectLinkSkills(u, { character_link_skill: [s] }));
      if (isEmptyBlock(b)) continue;
      const key = String(s.skill_name ?? '').replace(/\([^)]*\)\s*$/, '').trim();
      links[key] = b;
    }
  }

  const ownedAll = new Set<string>();
  for (const arr of Object.values(bundle.skills ?? {})) for (const s of arr) ownedAll.add(s.skill_name);
  const blessSkip = new Set<string>();
  {
    const atkOf = (name: string): number => {
      for (const arr of Object.values(bundle.skills ?? {})) {
        for (const s of arr) {
          if (s.skill_name !== name) continue;
          const m = String(s.skill_effect ?? '').match(/공격력\s*\+?\s*(\d+(?:\.\d+)?)/);
          return m ? Number(m[1]) : -1;
        }
      }
      return -1;
    };
    const emp = atkOf('여제의 축복'), spi = atkOf('정령의 축복');
    if (emp >= 0 && spi >= 0) blessSkip.add(emp >= spi ? '정령의 축복' : '여제의 축복');
  }
  const skillsByGrade: Record<string, Record<string, StatBlock>> = {};
  for (const grade of ['0', '1', '2', '3', '4', '5']) {
    for (const s of bundle.skills?.[grade] ?? []) {
      if (blessSkip.has(s.skill_name)) continue;
      const b = blockOf((u) => collectSkillPassive(u, cls, { [grade]: [s] } as SkillsByGrade, ownedAll));
      if (isEmptyBlock(b)) continue;
      (skillsByGrade[grade] ??= {})[s.skill_name] = b;
    }
  }

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
    길드스킬: blockOf((u) => bundle.guild && collectGuild(u, bundle.guild)),
    캐시장비: blockOf((u) => bundle.cash && collectCash(u, bundle.cash)),
  };
  // 찬란한 결계의 핵은 하드코딩하지 않는다 — 값이 아이템 등급·강화에 있고 API 미노출이라 잔차로 드러나는 게 맞다.
  const bullet: StatBlock | null = (bundle.skills?.['2'] ?? []).some((s) => s.skill_name === '인피닛 불릿')
    ? { 공격력: 10 }
    : null;

  const out: CharacterStats = { 기본: { 크확: 5, 크뎀: 35 }, AP: blockOf((u) => collectBaseAP(u, statMap)) };
  if (mwPct) out.메이플용사 = mwPct;
  if ((bundle.skills?.['5'] ?? []).some((s) => s.skill_name === '크리티컬 리인포스')) out.크리티컬리인포스 = 50;
  if (Object.keys(gear).length) out.장비 = gear;
  if (Object.keys(sets).length) out.세트효과 = sets;
  for (const k of ['심볼', '하이퍼스탯', '어빌리티', '유니온', '아티팩트', '챔피언', '성향'] as const) {
    if (!isEmptyBlock(single[k])) out[k] = single[k];
  }
  for (const [grade, rec] of Object.entries(skillsByGrade)) (out as any)[`스킬_${grade}차`] = rec;
  if (Object.keys(links).length) out.링크스킬 = links;
  if (!isEmptyBlock(single.길드스킬)) out.길드스킬 = single.길드스킬;
  if (!isEmptyBlock(single.캐시장비)) out.캐시장비 = single.캐시장비;
  if (!isEmptyBlock(single.헥사스탯)) out.헥사스탯 = single.헥사스탯;
  if (!isEmptyBlock(single.챌린저스)) out.챌린저스 = single.챌린저스;
  if (!isEmptyBlock(single.버닝)) out.버닝 = single.버닝;
  if (bullet) out.불릿 = bullet;
  return { stats: out, notes };
}
