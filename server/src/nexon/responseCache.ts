import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * 넥슨 공식 OpenAPI 원시 응답 캐시. 키는 요청 URL(= 엔드포인트 + ocid 등 파라미터)이다.
 *
 * 파생값이 아니라 응답 원본을 저장한다. 파생 로직(getCharacterStats)을 아무리 바꿔도
 * 캐시는 살아남고, 넥슨이 응답 스키마를 바꿀 때만 무효가 된다.
 * API 키는 헤더라 URL에 안 섞이므로 키가 바뀌어도 캐시는 유효하다.
 */

interface CachedResponse {
  url: string;
  fetchedAt: string;
  data: unknown;
}

const memory = new Map<string, unknown>();
let legacyRemoved = false;

function dataDirectory(): string {
  if (process.env.MAPLE_AUCTION_DATA_DIR) return process.env.MAPLE_AUCTION_DATA_DIR;
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'maple-auction-mcp');
  }
  if (process.platform === 'win32') {
    return join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'maple-auction-mcp');
  }
  return join(process.env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share'), 'maple-auction-mcp');
}

export function getNexonResponseCacheDirectory(): string {
  return join(dataDirectory(), 'nexon-api');
}

// 파생 스냅샷을 저장하던 구 캐시. 재사용하지 않으므로 한 번 지우고 만다.
async function removeLegacySnapshotCache(): Promise<void> {
  if (legacyRemoved) return;
  legacyRemoved = true;
  await rm(join(dataDirectory(), 'character-snapshots'), { recursive: true, force: true }).catch(() => undefined);
}

function cacheFile(url: string): string {
  return join(getNexonResponseCacheDirectory(), `${createHash('sha256').update(url).digest('hex')}.json`);
}

export async function readCachedResponse(url: string): Promise<{ data: unknown } | null> {
  if (memory.has(url)) return { data: memory.get(url) };
  try {
    const parsed = JSON.parse(await readFile(cacheFile(url), 'utf8')) as Partial<CachedResponse>;
    if (parsed.url !== url || !('data' in parsed)) return null;
    memory.set(url, parsed.data);
    return { data: parsed.data };
  } catch {
    return null;
  }
}

export async function writeCachedResponse(url: string, data: unknown): Promise<void> {
  memory.set(url, data);

  const entry: CachedResponse = { url, fetchedAt: new Date().toISOString(), data };
  const destination = cacheFile(url);
  const temporary = `${destination}.${process.pid}.${Date.now()}.tmp`;
  await mkdir(getNexonResponseCacheDirectory(), { recursive: true, mode: 0o700 });
  await removeLegacySnapshotCache();
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

export function clearNexonResponseCache(): void {
  memory.clear();
}
