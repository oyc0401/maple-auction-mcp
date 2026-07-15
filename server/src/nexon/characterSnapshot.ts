import { getCharacterStats } from '../damage/characterStats.js';
import type { CharacterStats } from '../damage/stat-interface.js';
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
} from './character.js';
import type { ItemEquipmentRes } from './types.js';

export interface CharacterSnapshot {
  name: string;
  job: string;
  level: number;
  stats: CharacterStats;
  equipment: ItemEquipmentRes;
}

export type LoadCharacterSnapshot = (name: string) => Promise<CharacterSnapshot>;

const CHARACTER_SNAPSHOT_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; snapshot: CharacterSnapshot }>();
const inFlight = new Map<string, Promise<CharacterSnapshot>>();

async function fetchCharacterSnapshot(name: string): Promise<CharacterSnapshot> {
  const { ocid } = await getOcid(name);
  const stat = await getCharacterStat(ocid);
  const basic = await getCharacterBasic(ocid);
  const equipment = await getItemEquipment(ocid);
  const setEffect = await getSetEffect(ocid);
  const symbol = await getSymbolEquipment(ocid);
  const hyper = await getHyperStat(ocid);
  const ability = await getAbility(ocid);
  const union = await getUnionRaider(ocid);
  const artifact = await getUnionArtifact(ocid);
  const champion = await getUnionChampion(ocid);
  const propensity = await getPropensity(ocid);
  const hexa = await getHexaMatrixStat(ocid);
  const cash = await getCashItemEquipment(ocid);
  const link = await getLinkSkill(ocid);
  const skill0 = await getSkill(ocid, '0');
  const skill1 = await getSkill(ocid, '1');
  const skill2 = await getSkill(ocid, '2');
  const skill3 = await getSkill(ocid, '3');
  const skill4 = await getSkill(ocid, '4');
  const hyperPassive = await getSkill(ocid, 'hyperpassive');
  const hyperActive = await getSkill(ocid, 'hyperactive');
  const skill5 = await getSkill(ocid, '5');

  let guild = null;
  if (basic.character_guild_name) {
    const { oguild_id } = await getGuildId(basic.character_guild_name, basic.world_name);
    guild = await getGuildBasic(oguild_id);
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

export const loadCharacterSnapshot: LoadCharacterSnapshot = async (name) => {
  const cached = cache.get(name);
  if (cached && cached.expiresAt > Date.now()) return cached.snapshot;
  if (cached) cache.delete(name);

  const pending = inFlight.get(name);
  if (pending) return pending;

  const request = fetchCharacterSnapshot(name)
    .then((snapshot) => {
      cache.set(name, {
        expiresAt: Date.now() + CHARACTER_SNAPSHOT_TTL_MS,
        snapshot,
      });
      return snapshot;
    })
    .finally(() => inFlight.delete(name));
  inFlight.set(name, request);
  return request;
};

export function clearCharacterSnapshotCache(): void {
  cache.clear();
  inFlight.clear();
}
