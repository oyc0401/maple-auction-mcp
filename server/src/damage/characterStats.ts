import {
  getAbility as fetchAbility,
  getPropensity as fetchPropensity,
  getSkill as fetchSkill,
  getUnionRaider as fetchUnionRaider,
  type GuildBasicRes,
  getCashItemEquipment,
  getCharacterBasic,
  getCharacterStat,
  getGuildBasic,
  getGuildId,
  getHexaMatrixStat,
  getHyperStat,
  getItemEquipment,
  getLinkSkill,
  getSetEffect,
  getSymbolEquipment,
  getUnionArtifact,
  getUnionChampion,
} from '../nexon/index.js';
import { getAbility } from './stat/ability.js';
import { getArtifact } from './stat/artifact.js';
import { getCash } from './stat/cash.js';
import { getChampion } from './stat/champion.js';
import { getAP, getGear, getSet } from './stat/gear.js';
import { getGuild } from './stat/guild.js';
import { getHexaStat } from './stat/hexaStat.js';
import { getHyper } from './stat/hyper.js';
import { getLink } from './stat/link.js';
import { getPropensity } from './stat/propensity.js';
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

export async function getCharacterStats(ocid: string): Promise<CharacterStats> {
  const stat = await getCharacterStat(ocid);
  const basic = await getCharacterBasic(ocid);
  const equip = await getItemEquipment(ocid);
  const setEffect = await getSetEffect(ocid);
  const symbol = await getSymbolEquipment(ocid);
  const hyper = await getHyperStat(ocid);
  const ability = await fetchAbility(ocid);
  const union = await fetchUnionRaider(ocid);
  const artifact = await getUnionArtifact(ocid);
  const champion = await getUnionChampion(ocid);
  const propensity = await fetchPropensity(ocid);
  const hexa = await getHexaMatrixStat(ocid);
  const cash = await getCashItemEquipment(ocid);
  const link = await getLinkSkill(ocid);

  const skill0 = await fetchSkill(ocid, '0');
  const skill1 = await fetchSkill(ocid, '1');
  const skill2 = await fetchSkill(ocid, '2');
  const skill3 = await fetchSkill(ocid, '3');
  const skill4 = await fetchSkill(ocid, '4');
  const hyperPassive = await fetchSkill(ocid, 'hyperpassive');
  const hyperActive = await fetchSkill(ocid, 'hyperactive');
  const skill5 = await fetchSkill(ocid, '5');

  let guild: GuildBasicRes | null = null;
  if (basic.character_guild_name) {
    const { oguild_id } = await getGuildId(
      basic.character_guild_name,
      basic.world_name
    );
    guild = await getGuildBasic(oguild_id);
  }

  return {
    기본: { 크확: 5, 크뎀: 35 },
    AP: getAP(stat),
    장비: getGear(equip, basic.character_level),
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

    메이플용사: getMapleWarrior(skill4),
    크리티컬리인포스: getCriticalReinforce(skill5),
    스킬_0차: getSkill0(skill0),
    스킬: getSkill(
      skill1,
      skill2,
      skill3,
      skill4,
      hyperPassive,
      hyperActive,
      skill5
    ),
    헥사스탯: getHexaStat(hexa),
  };
}
