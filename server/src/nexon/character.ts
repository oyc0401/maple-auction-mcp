import { requestNexonOpenApi, type NexonApiKeyOrOptions } from './client.js';
import type {
  AbilityRes,
  CashItemEquipmentRes,
  CharacterBasic,
  CharacterStat,
  GuildBasicRes,
  GuildIdRes,
  HexaMatrixStatRes,
  HyperStatRes,
  ItemEquipmentRes,
  LinkSkillRes,
  OcidRes,
  PropensityRes,
  SetEffectRes,
  SkillGrade,
  SkillRes,
  SymbolEquipmentRes,
  UnionArtifactRes,
  UnionChampionRes,
  UnionRaiderRes,
} from './types.js';

export async function getOcid(characterName: string, keyOrOptions?: NexonApiKeyOrOptions): Promise<OcidRes> {
  return requestNexonOpenApi('/id', { character_name: characterName }, keyOrOptions);
}

export async function getCharacterStat(ocid: string, keyOrOptions?: NexonApiKeyOrOptions): Promise<CharacterStat> {
  return requestNexonOpenApi('/character/stat', { ocid }, keyOrOptions);
}

export async function getCharacterBasic(ocid: string, keyOrOptions?: NexonApiKeyOrOptions): Promise<CharacterBasic> {
  return requestNexonOpenApi('/character/basic', { ocid }, keyOrOptions);
}

export async function getItemEquipment(ocid: string, keyOrOptions?: NexonApiKeyOrOptions): Promise<ItemEquipmentRes> {
  return requestNexonOpenApi('/character/item-equipment', { ocid }, keyOrOptions);
}

export async function getSetEffect(ocid: string, keyOrOptions?: NexonApiKeyOrOptions): Promise<SetEffectRes> {
  return requestNexonOpenApi('/character/set-effect', { ocid }, keyOrOptions);
}

export async function getSymbolEquipment(ocid: string, keyOrOptions?: NexonApiKeyOrOptions): Promise<SymbolEquipmentRes> {
  return requestNexonOpenApi('/character/symbol-equipment', { ocid }, keyOrOptions);
}

export async function getHyperStat(ocid: string, keyOrOptions?: NexonApiKeyOrOptions): Promise<HyperStatRes> {
  return requestNexonOpenApi('/character/hyper-stat', { ocid }, keyOrOptions);
}

export async function getAbility(ocid: string, keyOrOptions?: NexonApiKeyOrOptions): Promise<AbilityRes> {
  return requestNexonOpenApi('/character/ability', { ocid }, keyOrOptions);
}

export async function getLinkSkill(ocid: string, keyOrOptions?: NexonApiKeyOrOptions): Promise<LinkSkillRes> {
  return requestNexonOpenApi('/character/link-skill', { ocid }, keyOrOptions);
}

export async function getPropensity(ocid: string, keyOrOptions?: NexonApiKeyOrOptions): Promise<PropensityRes> {
  return requestNexonOpenApi('/character/propensity', { ocid }, keyOrOptions);
}

export async function getSkill(ocid: string, grade: SkillGrade, keyOrOptions?: NexonApiKeyOrOptions): Promise<SkillRes> {
  return requestNexonOpenApi('/character/skill', { ocid, character_skill_grade: grade }, keyOrOptions);
}

export async function getHexaMatrixStat(ocid: string, keyOrOptions?: NexonApiKeyOrOptions): Promise<HexaMatrixStatRes> {
  return requestNexonOpenApi('/character/hexamatrix-stat', { ocid }, keyOrOptions);
}

export async function getCashItemEquipment(ocid: string, keyOrOptions?: NexonApiKeyOrOptions): Promise<CashItemEquipmentRes> {
  return requestNexonOpenApi('/character/cashitem-equipment', { ocid }, keyOrOptions);
}

export async function getUnionRaider(ocid: string, keyOrOptions?: NexonApiKeyOrOptions): Promise<UnionRaiderRes> {
  return requestNexonOpenApi('/user/union-raider', { ocid }, keyOrOptions);
}

export async function getUnionArtifact(ocid: string, keyOrOptions?: NexonApiKeyOrOptions): Promise<UnionArtifactRes> {
  return requestNexonOpenApi('/user/union-artifact', { ocid }, keyOrOptions);
}

export async function getUnionChampion(ocid: string, keyOrOptions?: NexonApiKeyOrOptions): Promise<UnionChampionRes> {
  return requestNexonOpenApi('/user/union-champion', { ocid }, keyOrOptions);
}

export async function getGuildId(guildName: string, worldName: string, keyOrOptions?: NexonApiKeyOrOptions): Promise<GuildIdRes> {
  return requestNexonOpenApi('/guild/id', { guild_name: guildName, world_name: worldName }, keyOrOptions);
}

export async function getGuildBasic(oguildId: string, keyOrOptions?: NexonApiKeyOrOptions): Promise<GuildBasicRes> {
  return requestNexonOpenApi('/guild/basic', { oguild_id: oguildId }, keyOrOptions);
}
