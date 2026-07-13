import { readdir, readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { getCharacterStat, getOcid, NexonOpenApiError } from '../src/nexon/index.js';

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response;
}

describe('넥슨 공식 OpenAPI 클라이언트', () => {
  it('client.ts 밖에서 넥슨 API를 fetch로 직접 호출하지 않는다', async () => {
    const nexonDir = new URL('../src/nexon/', import.meta.url);
    const files = (await readdir(nexonDir)).filter((file) => file.endsWith('.ts') && file !== 'client.ts');
    const violations: string[] = [];

    for (const file of files) {
      const source = await readFile(new URL(file, nexonDir), 'utf8');
      if (/\bfetch\s*\(/.test(source)) violations.push(file);
    }

    expect(violations).toEqual([]);
  });

  it('공식 base URL과 x-nxopen-api-key 헤더로 GET 호출한다', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ ocid: 'OCID' }));

    const result = await getOcid('오유찬', { apiKey: 'test-key', fetchFn });

    expect(result.ocid).toBe('OCID');
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.href).toBe('https://open.api.nexon.com/maplestory/v1/id?character_name=%EC%98%A4%EC%9C%A0%EC%B0%AC');
    expect(init.headers).toEqual({ 'x-nxopen-api-key': 'test-key' });
  });

  it('429는 재시도하지 않는다', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ message: 'rate limited' }, 429));

    await expect(getCharacterStat('OCID', { apiKey: 'rate-limit-key', fetchFn })).rejects.toMatchObject({
      status: 429,
      path: '/character/stat',
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('실패 응답은 상태 코드와 응답 본문을 보존한다', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ error: { name: 'OPENAPI00003', message: 'invalid key' } }, 401));

    await expect(getCharacterStat('OCID', { apiKey: 'bad-key', fetchFn })).rejects.toMatchObject({
      name: 'NexonOpenApiError',
      status: 401,
      path: '/character/stat',
      detail: { error: { name: 'OPENAPI00003', message: 'invalid key' } },
    } satisfies Partial<NexonOpenApiError>);
  });

  it('같은 API 키의 동시 요청을 10초 간격으로 시작한다', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-13T00:00:00Z'));
    try {
      const fetchFn = vi.fn(async () => jsonResponse({ ocid: 'OCID', character_class: '카데나', final_stat: [] }));

      const first = getOcid('오유찬', { apiKey: 'spacing-key', fetchFn });
      const second = getCharacterStat('OCID', { apiKey: 'spacing-key', fetchFn });

      await vi.advanceTimersByTimeAsync(0);
      expect(fetchFn).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(9_999);
      expect(fetchFn).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      await Promise.all([first, second]);
      expect(fetchFn).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
