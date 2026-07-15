import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
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
export type RefreshCharacterSnapshot = LoadCharacterSnapshot;

interface CachedCharacterSnapshot {
  version: 2;
  fetchedAt: string;
  snapshot: CharacterSnapshot;
}

const cache = new Map<string, CachedCharacterSnapshot>();
const inFlight = new Map<string, Promise<CharacterSnapshot>>();

export function getCharacterSnapshotCacheDirectory(): string {
  if (process.env.MAPLE_AUCTION_DATA_DIR) {
    return join(process.env.MAPLE_AUCTION_DATA_DIR, 'character-snapshots');
  }
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'maple-auction-mcp', 'character-snapshots');
  }
  if (process.platform === 'win32') {
    return join(
      process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'),
      'maple-auction-mcp',
      'character-snapshots'
    );
  }
  return join(
    process.env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share'),
    'maple-auction-mcp',
    'character-snapshots'
  );
}

function cacheFile(name: string): string {
  return join(getCharacterSnapshotCacheDirectory(), `${encodeURIComponent(name)}.json`);
}

async function readCachedSnapshot(name: string): Promise<CachedCharacterSnapshot | null> {
  try {
    const parsed = JSON.parse(await readFile(cacheFile(name), 'utf8')) as Partial<CachedCharacterSnapshot>;
    if (parsed.version !== 2 || !parsed.fetchedAt || !parsed.snapshot) return null;
    if (parsed.snapshot.name !== name) return null;
    return parsed as CachedCharacterSnapshot;
  } catch {
    return null;
  }
}

async function writeCachedSnapshot(entry: CachedCharacterSnapshot): Promise<void> {
  const directory = getCharacterSnapshotCacheDirectory();
  const destination = cacheFile(entry.snapshot.name);
  const temporary = `${destination}.${process.pid}.${Date.now()}.tmp`;
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(temporary, JSON.stringify(entry), { encoding: 'utf8', mode: 0o600 });
  try {
    await rename(temporary, destination);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (process.platform !== 'win32' || (code !== 'EEXIST' && code !== 'EPERM')) throw error;
    await rm(destination, { force: true });
    await rename(temporary, destination);
  }
}

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
  if (cached) return cached.snapshot;

  const persisted = await readCachedSnapshot(name);
  if (persisted) {
    cache.set(name, persisted);
    return persisted.snapshot;
  }

  const pending = inFlight.get(name);
  if (pending) return pending;

  return refreshCharacterSnapshot(name);
};

export const refreshCharacterSnapshot: RefreshCharacterSnapshot = async (name) => {
  const pending = inFlight.get(name);
  if (pending) return pending;

  const request = fetchCharacterSnapshot(name)
    .then(async (snapshot) => {
      const entry: CachedCharacterSnapshot = {
        version: 2,
        fetchedAt: new Date().toISOString(),
        snapshot,
      };
      await writeCachedSnapshot(entry);
      cache.set(name, entry);
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
