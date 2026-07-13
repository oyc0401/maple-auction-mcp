import {
  getAbility as fetchAbility,
  getCashItemEquipment,
  getCharacterBasic,
  getCharacterStat,
  getGuildBasic,
  getGuildId,
  getHexaMatrixStat,
  getHyperStat,
  getItemEquipment,
  getLinkSkill,
  getPropensity as fetchPropensity,
  getSetEffect,
  getSkill as fetchSkill,
  getSymbolEquipment,
  getUnionArtifact,
  getUnionChampion,
  getUnionRaider,
  type AbilityRes,
  type CashItemEquipmentRes,
  type CharacterStat,
  type GuildBasicRes,
  type HexaMatrixStatRes,
  type HyperStatRes,
  type ItemEquipmentRes,
  type LinkSkillRes,
  type PropensityRes,
  type SetEffectRes,
  type SkillRes,
  type SymbolEquipmentRes,
  type UnionArtifactRes,
  type UnionChampionRes,
  type UnionRaiderRes,
} from '../nexon/index.js';
import type { CharacterStats, GearStats, StatBlock } from './stat-interface.js';
import { getSkill, getSkill0 } from './stat/skill.js';

export async function getCharacterStats(ocid: string): Promise<CharacterStats> {
  const stat = await getCharacterStat(ocid);
  const basic = await getCharacterBasic(ocid);
  const equip = await getItemEquipment(ocid);
  const setEffect = await getSetEffect(ocid);
  const symbol = await getSymbolEquipment(ocid);
  const hyper = await getHyperStat(ocid);
  const ability = await fetchAbility(ocid);
  const union = await getUnionRaider(ocid);
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
    const { oguild_id } = await getGuildId(basic.character_guild_name, basic.world_name);
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
    유니온: getUnion(union),
    아티팩트: getArtifact(artifact),
    챔피언: getChampion(champion),

    성향: getPropensity(propensity),


    길드스킬: getGuild(guild),
    캐시장비: getCash(cash),
    링크스킬: getLink(link),

    메이플용사: getMapleWarrior(skill4),
    크리티컬리인포스: getCriticalReinforce(skill5),
    스킬_0차: getSkill0(skill0),
    스킬: getSkill(skill1, skill2, skill3, skill4, hyperPassive, hyperActive, skill5),
  헥사스탯: getHexaStat(hexa),
  };
}

// 각 변환 함수는 필요한 넥슨 응답만 받는다. 구현은 파트별로 이관한다.
function getAP(_stat: CharacterStat): StatBlock { throw new Error('TODO: getAP'); }
function getGear(_equip: ItemEquipmentRes, _level: number): GearStats { throw new Error('TODO: getGear'); }
function getSet(_setEffect: SetEffectRes): Record<string, StatBlock> { throw new Error('TODO: getSet'); }
function getSymbol(_symbol: SymbolEquipmentRes): StatBlock { throw new Error('TODO: getSymbol'); }
function getHyper(_hyper: HyperStatRes): StatBlock { throw new Error('TODO: getHyper'); }
function getAbility(_ability: AbilityRes): StatBlock { throw new Error('TODO: getAbility'); }
function getUnion(_union: UnionRaiderRes): StatBlock { throw new Error('TODO: getUnion'); }
function getArtifact(_artifact: UnionArtifactRes): StatBlock { throw new Error('TODO: getArtifact'); }
function getChampion(_champion: UnionChampionRes): StatBlock { throw new Error('TODO: getChampion'); }
function getPropensity(_propensity: PropensityRes): StatBlock { throw new Error('TODO: getPropensity'); }
function getHexaStat(_hexa: HexaMatrixStatRes): StatBlock { throw new Error('TODO: getHexaStat'); }
function getGuild(_guild: GuildBasicRes | null): StatBlock { throw new Error('TODO: getGuild'); }
function getCash(_cash: CashItemEquipmentRes): StatBlock { throw new Error('TODO: getCash'); }
function getLink(_link: LinkSkillRes): Record<string, StatBlock> { throw new Error('TODO: getLink'); }
function getMapleWarrior(_skill4: SkillRes): number { throw new Error('TODO: getMapleWarrior'); }
function getCriticalReinforce(_skill5: SkillRes): number { throw new Error('TODO: getCriticalReinforce'); }
