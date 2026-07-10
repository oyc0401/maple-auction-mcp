import { describe, it, expect, vi } from 'vitest';
import type { WireFetchCommand } from '@maple/shared';
import { executeFetch } from '../src/api.js';

function cmd(over: Partial<WireFetchCommand> = {}): WireFetchCommand {
  return {
    id: 'r1',
    type: 'fetch',
    url: 'https://api.mskr.nexon.com/v1/accounts',
    method: 'GET',
    headers: { accept: 'application/json', 'x-client-version': '9.9.9' },
    ...over,
  };
}

function okFetch(body = '{"hello":1}', status = 200) {
  return vi.fn(async () => new Response(body, { status }));
}

describe('허용목록 (보안 불변식)', () => {
  it.each([
    'http://api.mskr.nexon.com/v1/accounts', // https 아님
    'http://api.maplescouter.com/api/id', // https 아님
    'https://evil.example.com/steal',
    'https://evil-nexon.com/x', // .nexon.com으로 끝나지 않음
    'https://nexon.com.evil.io/x',
    'https://maplescouter.com.evil.io/x', // .maplescouter.com으로 끝나지 않음
    'https://evil-maplescouter.com/x',
    '::not-a-url::',
  ])('%s 는 FORBIDDEN_URL로 거부하고 fetch를 호출하지 않는다', async (url) => {
    const f = okFetch();
    const r = await executeFetch(cmd({ url }), f);
    expect(!r.ok && r.code).toBe('FORBIDDEN_URL');
    expect(f).not.toHaveBeenCalled();
  });

  it.each([
    'https://nexon.com/x',
    'https://api.mskr.nexon.com/v1/accounts',
    'https://maplescouter.com/x',
    'https://api.maplescouter.com/api/id?name=x', // 환산 계산기 (CF 우회용)
  ])('%s 는 허용한다', async (url) => {
    const r = await executeFetch(cmd({ url }), okFetch());
    expect(r.ok).toBe(true);
  });
});

describe('범용 실행기', () => {
  it('서버가 준 헤더·메서드·바디를 그대로 적용하고 credentials:include로 보낸다', async () => {
    const f = okFetch();
    await executeFetch(cmd({ method: 'POST', body: '{"a":1}' }), f);
    expect(f).toHaveBeenCalledWith('https://api.mskr.nexon.com/v1/accounts', {
      method: 'POST',
      credentials: 'include',
      headers: { accept: 'application/json', 'x-client-version': '9.9.9' },
      body: '{"a":1}',
    });
  });

  it('응답을 파싱하지 않고 원문 bodyText로 돌려준다 (비JSON 포함)', async () => {
    const r = await executeFetch(cmd(), okFetch('plain text!'));
    expect(r.ok && r.bodyText).toBe('plain text!');
    expect(r.status).toBe(200);
  });

  it('4xx/5xx는 HTTP_ERROR + status + bodyText', async () => {
    const r = await executeFetch(cmd(), okFetch('{"code":12}', 401));
    expect(!r.ok && r.code).toBe('HTTP_ERROR');
    expect(r.status).toBe(401);
    expect(!r.ok && r.bodyText).toBe('{"code":12}');
  });

  it('fetch 예외는 NETWORK', async () => {
    const f = vi.fn(async () => {
      throw new Error('boom');
    });
    const r = await executeFetch(cmd(), f as unknown as typeof fetch);
    expect(!r.ok && r.code).toBe('NETWORK');
  });
});
