import { getCharacterStats } from './damage/characterStats.js';
import type { CharacterStats } from './damage/stat-interface.js';
import {
  getAbility,
  getCashItemEquipment,
  getCharacterBasic,
  getCharacterStat,
  getGuildBasic,
  getGuildId,
  getHexaMatrixStat,
  getHyperStat,
  getItemEquipment,
  getLinkSkill,
  getOcid,
  getPropensity,
  getSetEffect,
  getSkill,
  getSymbolEquipment,
  getUnionArtifact,
  getUnionChampion,
  getUnionRaider,
  type ItemEquipmentRes,
  type NexonApiOptions,
} from './nexon/index.js';

export interface CharacterSnapshot {
  name: string;
  job: string;
  level: number;
  stats: CharacterStats;
  equipment: ItemEquipmentRes;
}

export type LoadCharacterSnapshot = (name: string) => Promise<CharacterSnapshot>;
export type RefreshCharacterSnapshot = LoadCharacterSnapshot;

/**
 * 스냅샷 자체는 캐시하지 않는다. 넥슨 응답 원본이 client.ts 아래에서 캐시되고,
 * 스냅샷은 그 원본에서 매번 다시 파생된다. 그래서 파생 로직이 바뀌어도 재요청이 없다.
 */
async function fetchCharacterSnapshot(name: string, options?: NexonApiOptions): Promise<CharacterSnapshot> {
  const { ocid } = await getOcid(name, options);
  const stat = await getCharacterStat(ocid, options);
  const basic = await getCharacterBasic(ocid, options);
  const equipment = await getItemEquipment(ocid, options);
  const setEffect = await getSetEffect(ocid, options);
  const symbol = await getSymbolEquipment(ocid, options);
  const hyper = await getHyperStat(ocid, options);
  const ability = await getAbility(ocid, options);
  const union = await getUnionRaider(ocid, options);
  const artifact = await getUnionArtifact(ocid, options);
  const champion = await getUnionChampion(ocid, options);
  const propensity = await getPropensity(ocid, options);
  const hexa = await getHexaMatrixStat(ocid, options);
  const cash = await getCashItemEquipment(ocid, options);
  const link = await getLinkSkill(ocid, options);
  const skill0 = await getSkill(ocid, '0', options);
  const skill1 = await getSkill(ocid, '1', options);
  const skill2 = await getSkill(ocid, '2', options);
  const skill3 = await getSkill(ocid, '3', options);
  const skill4 = await getSkill(ocid, '4', options);
  const hyperPassive = await getSkill(ocid, 'hyperpassive', options);
  const hyperActive = await getSkill(ocid, 'hyperactive', options);
  const skill5 = await getSkill(ocid, '5', options);

  let guild = null;
  if (basic.character_guild_name) {
    const { oguild_id } = await getGuildId(basic.character_guild_name, basic.world_name, options);
    guild = await getGuildBasic(oguild_id, options);
  }

  return {
    name,
    job: basic.character_class ?? stat.character_class,
    level: basic.character_level,
    equipment,
    stats: getCharacterStats({
      stat,
      basic,
      equipment,
      setEffect,
      symbol,
      hyper,
      ability,
      union,
      artifact,
      champion,
      propensity,
      hexa,
      cash,
      link,
      guild,
      skills: {
        '0': skill0,
        '1': skill1,
        '2': skill2,
        '3': skill3,
        '4': skill4,
        hyperPassive,
        hyperActive,
        '5': skill5,
      },
    }),
  };
}

export const loadCharacterSnapshot: LoadCharacterSnapshot = (name) => fetchCharacterSnapshot(name);

export const refreshCharacterSnapshot: RefreshCharacterSnapshot = (name) =>
  fetchCharacterSnapshot(name, { noCache: true });
