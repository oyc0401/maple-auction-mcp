import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestNexonOpenApi } from './client.js';
import { clearNexonResponseCache } from './responseCache.js';

// 캐시 디렉터리는 vitest.setup.ts가 임시 경로로 격리한다. 테스트마다 URL이 달라 서로 안 겹친다.
afterEach(() => {
  clearNexonResponseCache();
});

describe('넥슨 원시 응답 캐시', () => {
  it('프로세스 메모리가 비어도 저장소의 캐시를 다시 읽어 네트워크를 타지 않는다', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ ocid: 'OCID-1' }), { status: 200 }));
    const options = { apiKey: 'key-cache-hit', fetchFn: fetchFn as unknown as typeof fetch };

    const first = await requestNexonOpenApi('/id', { character_name: '영구캐릭터' }, options);
    clearNexonResponseCache();
    const second = await requestNexonOpenApi('/id', { character_name: '영구캐릭터' }, options);

    expect(first).toEqual({ ocid: 'OCID-1' });
    expect(second).toEqual({ ocid: 'OCID-1' });
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it('noCache는 캐시를 무시하고 다시 받아 저장소를 갱신한다', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ character_level: 280 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ character_level: 290 }), { status: 200 }));
    const options = { apiKey: 'key-no-cache', fetchFn: fetchFn as unknown as typeof fetch };

    await requestNexonOpenApi('/character/basic', { ocid: 'OCID-REFRESH' }, options);
    const refreshed = await requestNexonOpenApi('/character/basic', { ocid: 'OCID-REFRESH' }, { ...options, noCache: true });
    clearNexonResponseCache();
    const afterRefresh = await requestNexonOpenApi('/character/basic', { ocid: 'OCID-REFRESH' }, options);

    expect(refreshed).toEqual({ character_level: 290 });
    expect(afterRefresh).toEqual({ character_level: 290 });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('실패한 응답은 캐시하지 않는다', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'nope' } }), { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ocid: 'OCID-2' }), { status: 200 }));
    const options = { apiKey: 'key-error', fetchFn: fetchFn as unknown as typeof fetch };

    await expect(requestNexonOpenApi('/id', { character_name: '실패캐릭터' }, options)).rejects.toThrow('429');
    const retried = await requestNexonOpenApi('/id', { character_name: '실패캐릭터' }, options);

    expect(retried).toEqual({ ocid: 'OCID-2' });
  });
});
