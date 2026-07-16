import { describe, it, expect } from 'vitest';
import type { WireReply } from '@maple/shared';
import { AuctionBridge, MapleAuctionApi, auctionHeaders, type AuctionCommandInput, type AuctionReply, type WireTransport } from './api.js';

function transport(reply: WireReply): WireTransport & { last: () => Record<string, unknown> } {
  const calls: unknown[] = [];
  return {
    connected: true,
    request: async (cmd) => {
      calls.push(cmd);
      return reply;
    },
    last: () => calls[0] as Record<string, unknown>,
  };
}

describe('auctionHeaders', () => {
  it('실측 필수 헤더를 구성한다 (426 게이트 통과 세트)', () => {
    const h = auctionHeaders();
    expect(h['x-platform']).toBe('PC_WEB');
    expect(h['x-client-version']).toBe('1.0.1');
    expect(h['x-device-id']).toMatch(/^[0-9a-f]{32}$/);
    expect(h.accept).toContain('application/json');
    expect(h['Content-Type']).toBeUndefined();
  });

  it('바디가 있으면 Content-Type을 추가한다', () => {
    expect(auctionHeaders(true)['Content-Type']).toBe('application/json');
  });
});

describe('AuctionBridge — 내부 → 와이어 변환', () => {
  it('헤더를 주입하고 바디를 직렬화한다', async () => {
    const t = transport({ id: 'x', ok: true, status: 201, bodyText: '{"n":1}' });
    await new AuctionBridge(t).request({ type: 'fetch', url: 'https://a.nexon.com/x', method: 'POST', body: { q: 1 } });
    const wire = t.last();
    expect(wire.body).toBe('{"q":1}');
    expect((wire.headers as Record<string, string>)['x-platform']).toBe('PC_WEB');
    expect((wire.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('바디 없으면 body·Content-Type을 싣지 않는다', async () => {
    const t = transport({ id: 'x', ok: true, status: 200, bodyText: '{}' });
    await new AuctionBridge(t).request({ type: 'fetch', url: 'https://a.nexon.com/x', method: 'GET' });
    const wire = t.last();
    expect(wire.body).toBeUndefined();
    expect((wire.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });

  it('fanout 플래그를 와이어로 전달한다', async () => {
    const t = transport({ id: 'x', ok: true, status: 200, bodyText: '{}' });
    await new AuctionBridge(t).request({ type: 'fetch', url: 'https://a.nexon.com/x', method: 'GET', fanout: true });
    expect(t.last().fanout).toBe(true);
  });
});

describe('AuctionBridge — 와이어 → 내부 변환', () => {
  it('bodyText를 JSON 파싱해 data로 돌려준다', async () => {
    const t = transport({ id: 'x', ok: true, status: 200, bodyText: '{"total":3}' });
    const r = await new AuctionBridge(t).request({ type: 'fetch', url: 'https://a.nexon.com/x', method: 'GET' });
    expect(r.ok && (r.data as { total: number }).total).toBe(3);
  });

  it('비JSON bodyText는 data:null (구버전 동작 보존)', async () => {
    const t = transport({ id: 'x', ok: true, status: 200, bodyText: 'not json' });
    const r = await new AuctionBridge(t).request({ type: 'fetch', url: 'https://a.nexon.com/x', method: 'GET' });
    expect(r.ok && r.data).toBeNull();
  });

  it('HTTP_ERROR의 bodyText도 파싱한다 (errorText가 API code를 읽음)', async () => {
    const t = transport({ id: 'x', ok: false, code: 'HTTP_ERROR', status: 401, error: 'HTTP 401', bodyText: '{"code":12}' });
    const r = await new AuctionBridge(t).request({ type: 'fetch', url: 'https://a.nexon.com/x', method: 'GET' });
    expect(!r.ok && r.status).toBe(401);
    expect(!r.ok && (r.data as { code: number }).code).toBe(12);
  });

  it('bodyText 없는 에러(DISCONNECTED 등)는 data 없이 통과', async () => {
    const t = transport({ id: '', ok: false, code: 'DISCONNECTED', error: '미연결' });
    const r = await new AuctionBridge(t).request({ type: 'fetch', url: 'https://a.nexon.com/x', method: 'GET' });
    expect(!r.ok && r.code).toBe('DISCONNECTED');
    expect(!r.ok && r.data).toBeUndefined();
  });
});

describe('MapleAuctionApi — 세션 오류 자가복구', () => {
  it('401이면 /accounts fanout 프로브로 확장을 재선정한 뒤 원 요청을 1회 재시도한다', async () => {
    const calls: AuctionCommandInput[] = [];
    const replies: AuctionReply[] = [
      { id: '1', ok: false, code: 'HTTP_ERROR', status: 401, error: 'HTTP 401' },
      { id: '2', ok: true, status: 200, data: { accounts: [{ accountId: 1 }] } },
      { id: '3', ok: true, status: 200, data: { search: { remaining: 9 } } },
    ];
    const api = new MapleAuctionApi({
      connected: true,
      request: async (cmd) => {
        calls.push(cmd);
        return replies[calls.length - 1];
      },
    });

    const r = await api.getDailyLimit();

    expect(r.ok).toBe(true);
    expect(calls).toHaveLength(3);
    expect(calls[1]).toMatchObject({ url: 'https://api.mskr.nexon.com/v1/accounts', method: 'GET', fanout: true });
    expect(calls[2]).toEqual(calls[0]); // 원 요청 그대로 재전송 (fanout 없이)
  });

  it('프로브도 실패하면(어느 확장에도 세션 없음) 원래 401을 그대로 반환한다', async () => {
    const calls: AuctionCommandInput[] = [];
    const api = new MapleAuctionApi({
      connected: true,
      request: async (cmd) => {
        calls.push(cmd);
        return { id: 'x', ok: false, code: 'HTTP_ERROR', status: 401, error: 'HTTP 401' };
      },
    });

    const r = await api.getDailyLimit();

    expect(!r.ok && r.status).toBe(401);
    expect(calls).toHaveLength(2); // 원 요청 + 프로브, 재시도 없음
  });

  it('fanout 요청 자신은 401이어도 재시도하지 않는다', async () => {
    const calls: AuctionCommandInput[] = [];
    const api = new MapleAuctionApi({
      connected: true,
      request: async (cmd) => {
        calls.push(cmd);
        return { id: 'x', ok: false, code: 'HTTP_ERROR', status: 401, error: 'HTTP 401' };
      },
    });

    await api.getAccounts(true);

    expect(calls).toHaveLength(1);
  });

  it('401이 아닌 실패(TIMEOUT 등)는 재시도하지 않는다 — 소진성 POST 중복 방지', async () => {
    const calls: AuctionCommandInput[] = [];
    const api = new MapleAuctionApi({
      connected: true,
      request: async (cmd) => {
        calls.push(cmd);
        return { id: 'x', ok: false, code: 'TIMEOUT', error: '시간 초과' };
      },
    });

    await api.createSearch({ keyword: '앱솔랩스' });

    expect(calls).toHaveLength(1);
  });
});

describe('MapleAuctionApi — 외부 API 캡슐화', () => {
  it('페이지 조회 URL과 메서드를 파일 내부에서 구성한다', async () => {
    let command: AuctionCommandInput | undefined;
    const api = new MapleAuctionApi({
      connected: true,
      request: async (value) => {
        command = value;
        return { id: 'x', ok: true, status: 200, data: {} };
      },
    });

    await api.getSearchPage(
      '../../evil?x',
      { page: 2, limit: 40, sort: 'ATTACK_POWER_DESC' },
      { worldId: 5, accountId: 99188397, characterId: 25631906 }
    );

    expect(command?.method).toBe('GET');
    expect(command?.url).toBe(
      'https://api.mskr.nexon.com/v1/market/web/items/searches/..%2F..%2Fevil%3Fx/tool-tip?page=2&limit=40&sortType=ATTACK_POWER_DESC&accountId=99188397&characterId=25631906'
    );
  });

  it('검색 생성 엔드포인트와 POST 바디를 캡슐화한다', async () => {
    let command: AuctionCommandInput | undefined;
    const api = new MapleAuctionApi({
      connected: true,
      request: async (value) => {
        command = value;
        return { id: 'x', ok: true, status: 201, data: {} };
      },
    });
    const body = { keyword: '아케인셰이드' };

    await api.createSearch(body);

    expect(command).toMatchObject({
      url: 'https://api.mskr.nexon.com/v1/market/web/items/searches/tool-tip',
      method: 'POST',
      body,
    });
  });
});
