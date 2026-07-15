import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ItemEquipmentRes } from './types.js';
import {
  clearCharacterSnapshotCache,
  getCharacterSnapshotCacheDirectory,
  loadCharacterSnapshot,
} from './characterSnapshot.js';

afterEach(() => {
  clearCharacterSnapshotCache();
  delete process.env.MAPLE_AUCTION_DATA_DIR;
  vi.unstubAllGlobals();
});

describe('캐릭터 스냅샷 영구 캐시', () => {
  it('프로세스 메모리가 비어도 OS 데이터 디렉터리의 캐시를 다시 읽는다', async () => {
    const dataDirectory = await mkdtemp(join(tmpdir(), 'maple-auction-cache-'));
    process.env.MAPLE_AUCTION_DATA_DIR = dataDirectory;
    const cacheDirectory = getCharacterSnapshotCacheDirectory();
    await mkdir(cacheDirectory, { recursive: true });
    await writeFile(
      join(cacheDirectory, `${encodeURIComponent('영구캐릭터')}.json`),
      JSON.stringify({
        version: 1,
        fetchedAt: '2026-07-16T00:00:00.000Z',
        snapshot: {
          name: '영구캐릭터',
          job: '카데나',
          level: 290,
          stats: { 기본: {}, AP: {} },
          equipment: { item_equipment: [] } as unknown as ItemEquipmentRes,
        },
      })
    );
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    clearCharacterSnapshotCache();

    const snapshot = await loadCharacterSnapshot('영구캐릭터');

    expect(snapshot).toMatchObject({
      name: '영구캐릭터',
      job: '카데나',
      level: 290,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    await rm(dataDirectory, { recursive: true, force: true });
  });
});
