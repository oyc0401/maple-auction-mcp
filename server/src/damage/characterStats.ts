import type {
  AbilityRes,
  CashItemEquipmentRes,
  CharacterBasic,
  CharacterStat,
  GuildBasicRes,
  HexaMatrixStatRes,
  HyperStatRes,
  ItemEquipmentRes,
  LinkSkillRes,
  PropensityRes,
  SetEffectRes,
  SkillRes,
  SymbolEquipmentRes,
  UnionArtifactRes,
  UnionChampionRes,
  UnionRaiderRes,
} from '../nexon/index.js';
import { getAbility } from './stat/ability.js';
import { getAP } from './stat/ap.js';
import { getArtifact } from './stat/artifact.js';
import { getCash } from './stat/cash.js';
import { getChampion } from './stat/champion.js';
import { getGear } from './stat/gear.js';
import { getGuild } from './stat/guild.js';
import { getHexaStat } from './stat/hexaStat.js';
import { getHyper } from './stat/hyper.js';
import { getLink } from './stat/link.js';
import { getPropensity } from './stat/propensity.js';
import { getSet } from './stat/set.js';
import {
  getCriticalReinforce,
  getMapleWarrior,
  getSkill,
  getSkill0,
} from './stat/skill.js';
import { getSymbol } from './stat/symbol.js';
import { getUnionRaider } from './stat/unionRaider.js';
import { getUnionState } from './stat/unionState.js';
import type { CharacterStats } from './stat-interface.js';

export interface CharacterStatsSource {
  stat: CharacterStat;
  basic: CharacterBasic;
  equipment: ItemEquipmentRes;
  setEffect: SetEffectRes;
  symbol: SymbolEquipmentRes;
  hyper: HyperStatRes;
  ability: AbilityRes;
  union: UnionRaiderRes;
  artifact: UnionArtifactRes;
  champion: UnionChampionRes;
  propensity: PropensityRes;
  hexa: HexaMatrixStatRes;
  cash: CashItemEquipmentRes;
  link: LinkSkillRes;
  guild: GuildBasicRes | null;
  skills: {
    '0': SkillRes;
    '1': SkillRes;
    '2': SkillRes;
    '3': SkillRes;
    '4': SkillRes;
    hyperPassive: SkillRes;
    hyperActive: SkillRes;
    '5': SkillRes;
  };
}

export function getCharacterStats(source: CharacterStatsSource): CharacterStats {
  const { stat, basic, equipment, setEffect, symbol, hyper, ability, union, artifact, champion, propensity, hexa, cash, link, guild, skills } = source;

  return {
    기본: { 크확: 5, 크뎀: 35 },
    AP: getAP(stat),
    장비: getGear(equipment, basic.character_level),
    세트효과: getSet(setEffect),
    심볼: getSymbol(symbol),
    하이퍼스탯: getHyper(hyper),

    어빌리티: getAbility(ability),
    union_raider: getUnionRaider(union),
    union_state: getUnionState(union),
    아티팩트: getArtifact(artifact),
    챔피언: getChampion(champion),

    성향: getPropensity(propensity),

    길드스킬: getGuild(guild),
    캐시장비: getCash(cash),
    링크스킬: getLink(link),

    메이플용사: getMapleWarrior(skills['4']),
    크리티컬리인포스: getCriticalReinforce(skills['5']),
    스킬_0차: getSkill0(skills['0']),
    스킬: getSkill(
      skills['1'],
      skills['2'],
      skills['3'],
      skills['4'],
      skills.hyperPassive,
      skills.hyperActive,
      skills['5']
    ),
    헥사스탯: getHexaStat(hexa),
  };
}
