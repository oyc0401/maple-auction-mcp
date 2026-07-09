import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fetchScouter, baseSimulator, clearScouterCache } from '../src/hwansan2/scouterClient.js';

const idResponse = JSON.parse(readFileSync(new URL('../src/scouter/id-response', import.meta.url), 'utf8'));
const okFetch = () => vi.fn(async () => ({ ok: true, status: 201, json: async () => idResponse } as Response));

describe('scouterClient', () => {
  it('fetchScouter는 /api/id를 api-key 헤더로 호출하고 파싱한다', async () => {
    clearScouterCache();
    const f = okFetch();
    const d = await fetchScouter('오유찬', { fetchFn: f as any });
    expect(d.calculatedData.boss380_stat).toBe(30371);
    expect(d.userEquipData.length).toBe(24);
    const [url, init] = (f as any).mock.calls[0];
    expect(String(url)).toContain('/api/id?name=');
    expect((init as any).headers['api-key']).toMatch(/^[0-9a-f-]{36}$/);
  });
  it('fetchScouter는 TTL 내 재호출 시 캐시를 쓴다', async () => {
    clearScouterCache();
    const f = okFetch();
    await fetchScouter('오유찬', { fetchFn: f });
    await fetchScouter('오유찬', { fetchFn: f });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('baseSimulator는 캡처된 제로 시뮬 블록과 동일 형태(전 델타 0)다', () => {
    const sim = baseSimulator(idResponse.userStat) as any;
    expect(sim.mainStat).toBe('0');
    expect(sim.weaponAtk).toBe(idResponse.userStat.stat.weaponAtk);
    expect(sim.dopingSimul).toEqual(idResponse.userStat.doping);
    expect(sim.linkSimul).toEqual(idResponse.userStat.linkSkill);
  });
});
