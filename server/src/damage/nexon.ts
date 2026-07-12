import type { UserStat } from './statSheet.js';
import type { CharacterStats } from './stat-interface.js';
import type { SkillsByGrade } from './skillPassive.js';
import { buildCharacterStats, statMapOf, mainStatKeyOf } from './character.js';
import { flattenStats } from './block.js';

const BASE = 'https://open.api.nexon.com/maplestory/v1';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function nexonApiKey(): string | undefined {
  return process.env.NEXON_DEVELOPER_KEY || undefined;
}

async function getJson(path: string, params: Record<string, string>, key: string): Promise<any> {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'x-nxopen-api-key': key } });
    if (res.ok) return res.json();
    if (res.status === 429 && attempt < 5) { await sleep(600 * 2 ** attempt); continue; }
    let detail = '';
    try { detail = JSON.stringify(await res.json()); } catch { /* ignore */ }
    throw new Error(`넥슨 오픈 API ${res.status} ${path} ${detail}`);
  }
}

export interface CharFinal {
  characterName: string;
  characterClass: string;
  level: number;
  finalMain: Record<string, number>;
  statAtkMin: number; statAtkMax: number;
  raw: Record<string, number>;
}

export interface CharacterCollected {
  final: CharFinal;
  stats: CharacterStats;
  userStat: UserStat;
  warnings: string[];
  raw: Record<string, any>;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; data: CharacterCollected }>();
const inFlight = new Map<string, Promise<CharacterCollected>>();
export function clearNexonCache() { cache.clear(); inFlight.clear(); }

export interface RawBundle {
  stat: any; basic: any;
  equip: any; setEff: any; symbol: any; hyper: any; ability: any; link: any; union: any; artifact: any;
  champion: any; propensity: any;
  skills: SkillsByGrade; hexa: any;
  guild?: any; cash?: any;
}

export async function fetchCharacterRaw(characterName: string): Promise<{ raw: RawBundle; warnings: string[] }> {
  const key = nexonApiKey();
  if (!key) throw new Error('NEXON_DEVELOPER_KEY 미설정');

  const { ocid } = await getJson('/id', { character_name: characterName }, key);
  if (!ocid) throw new Error(`캐릭터를 찾지 못했습니다: ${characterName}`);

  const gap = () => sleep(Number(process.env.NEXON_GAP_MS ?? 250));
  const warnings: string[] = [];
  const stat = await getJson('/character/stat', { ocid }, key); await gap();
  const basic = await getJson('/character/basic', { ocid }, key).catch(() => ({})); await gap();
  const opt = async (label: string, path: string, extra: Record<string, string> = {}) => {
    try { const r = await getJson(path, { ocid, ...extra }, key); await gap(); return r; }
    catch (e) { warnings.push(`${label} 조회 실패: ${(e as Error).message}`); return null; }
  };
  const equip = await opt('장비', '/character/item-equipment');
  const setEff = await opt('세트효과', '/character/set-effect');
  const symbol = await opt('심볼', '/character/symbol-equipment');
  const hyper = await opt('하이퍼스탯', '/character/hyper-stat');
  const ability = await opt('어빌리티', '/character/ability');
  const link = await opt('링크스킬', '/character/link-skill');
  const union = await opt('유니온', '/user/union-raider');
  const artifact = await opt('유니온 아티팩트', '/user/union-artifact');
  const champion = await opt('유니온 챔피언', '/user/union-champion');
  const propensity = await opt('성향', '/character/propensity');
  const skills: SkillsByGrade = {};
  for (const grade of ['0', '1', '2', '3', '4', '5']) {
    const r = await opt(`스킬${grade}차`, '/character/skill', { character_skill_grade: grade });
    if (r) skills[grade] = r.character_skill ?? [];
  }
  const hexa = await opt('HEXA스탯', '/character/hexamatrix-stat');
  const cash = await opt('캐시장비', '/character/cashitem-equipment');
  let guild: any = null;
  if (basic?.character_guild_name && basic?.world_name) {
    try {
      const gid = await getJson('/guild/id', { guild_name: basic.character_guild_name, world_name: basic.world_name }, key); await gap();
      if (gid?.oguild_id) { guild = await getJson('/guild/basic', { oguild_id: gid.oguild_id }, key); await gap(); }
    } catch (e) { warnings.push(`길드 조회 실패: ${(e as Error).message}`); }
  }

  return { raw: { stat, basic, equip, setEff, symbol, hyper, ability, link, union, artifact, champion, propensity, skills, hexa, guild, cash }, warnings };
}

export function aggregateCharacter(characterName: string, bundle: RawBundle, warnings: string[]): CharacterCollected {
  const { stat, basic, equip, setEff, symbol, hyper, ability, union, skills, hexa } = bundle;
  const m = statMapOf(stat.final_stat);
  const level = Number(basic?.character_level ?? 0);
  const { stats, notes } = buildCharacterStats(bundle);
  const us = flattenStats(stats, level);
  const mainKey = mainStatKeyOf(m);

  const collected: CharacterCollected = {
    final: {
      characterName,
      characterClass: stat.character_class ?? basic.character_class ?? '',
      level: Number(basic.character_level ?? 0),
      finalMain: { STR: m['STR'] ?? 0, DEX: m['DEX'] ?? 0, INT: m['INT'] ?? 0, LUK: m['LUK'] ?? 0, HP: m['HP'] ?? 0 },
      statAtkMin: m['최소 스탯공격력'] ?? 0,
      statAtkMax: m['최대 스탯공격력'] ?? 0,
      raw: m,
    },
    stats,
    userStat: us,
    warnings: [...warnings, ...notes],
    raw: { statMap: m, equip, setEff, symbol, hyper, ability, union, skills, hexa, class: stat.character_class ?? '', mainKey, bundle },
  };
  return collected;
}

export async function collectCharacter(characterName: string): Promise<CharacterCollected> {
  const hit = cache.get(characterName);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;
  const running = inFlight.get(characterName);
  if (running) return running;
  const p = (async () => {
    const { raw, warnings } = await fetchCharacterRaw(characterName);
    const collected = aggregateCharacter(characterName, raw, warnings);
    cache.set(characterName, { at: Date.now(), data: collected });
    return collected;
  })().finally(() => inFlight.delete(characterName));
  inFlight.set(characterName, p);
  return p;
}
