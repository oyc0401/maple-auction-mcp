import { describe, it, expect } from 'vitest';
import type { WireReply } from '@maple/shared';
import { NexonBridge, nexonHeaders, type WireTransport } from '../src/nexon.js';

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

describe('nexonHeaders', () => {
  it('실측 필수 헤더를 구성한다 (426 게이트 통과 세트)', () => {
    const h = nexonHeaders();
    expect(h['x-platform']).toBe('PC_WEB');
    expect(h['x-client-version']).toBe('1.0.1');
    expect(h['x-device-id']).toMatch(/^[0-9a-f]{32}$/);
    expect(h.accept).toContain('application/json');
    expect(h['Content-Type']).toBeUndefined();
  });

  it('바디가 있으면 Content-Type을 추가한다', () => {
    expect(nexonHeaders(true)['Content-Type']).toBe('application/json');
  });
});

describe('NexonBridge — 내부 → 와이어 변환', () => {
  it('헤더를 주입하고 바디를 직렬화한다', async () => {
    const t = transport({ id: 'x', ok: true, status: 201, bodyText: '{"n":1}' });
    await new NexonBridge(t).request({ type: 'fetch', url: 'https://a.nexon.com/x', method: 'POST', body: { q: 1 } });
    const wire = t.last();
    expect(wire.body).toBe('{"q":1}');
    expect((wire.headers as Record<string, string>)['x-platform']).toBe('PC_WEB');
    expect((wire.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('바디 없으면 body·Content-Type을 싣지 않는다', async () => {
    const t = transport({ id: 'x', ok: true, status: 200, bodyText: '{}' });
    await new NexonBridge(t).request({ type: 'fetch', url: 'https://a.nexon.com/x', method: 'GET' });
    const wire = t.last();
    expect(wire.body).toBeUndefined();
    expect((wire.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });

  it('fanout 플래그를 와이어로 전달한다', async () => {
    const t = transport({ id: 'x', ok: true, status: 200, bodyText: '{}' });
    await new NexonBridge(t).request({ type: 'fetch', url: 'https://a.nexon.com/x', method: 'GET', fanout: true });
    expect(t.last().fanout).toBe(true);
  });
});

describe('NexonBridge — 와이어 → 내부 변환', () => {
  it('bodyText를 JSON 파싱해 data로 돌려준다', async () => {
    const t = transport({ id: 'x', ok: true, status: 200, bodyText: '{"total":3}' });
    const r = await new NexonBridge(t).request({ type: 'fetch', url: 'https://a.nexon.com/x', method: 'GET' });
    expect(r.ok && (r.data as { total: number }).total).toBe(3);
  });

  it('비JSON bodyText는 data:null (구버전 동작 보존)', async () => {
    const t = transport({ id: 'x', ok: true, status: 200, bodyText: 'not json' });
    const r = await new NexonBridge(t).request({ type: 'fetch', url: 'https://a.nexon.com/x', method: 'GET' });
    expect(r.ok && r.data).toBeNull();
  });

  it('HTTP_ERROR의 bodyText도 파싱한다 (errorText가 API code를 읽음)', async () => {
    const t = transport({ id: 'x', ok: false, code: 'HTTP_ERROR', status: 401, error: 'HTTP 401', bodyText: '{"code":12}' });
    const r = await new NexonBridge(t).request({ type: 'fetch', url: 'https://a.nexon.com/x', method: 'GET' });
    expect(!r.ok && r.status).toBe(401);
    expect(!r.ok && (r.data as { code: number }).code).toBe(12);
  });

  it('bodyText 없는 에러(DISCONNECTED 등)는 data 없이 통과', async () => {
    const t = transport({ id: '', ok: false, code: 'DISCONNECTED', error: '미연결' });
    const r = await new NexonBridge(t).request({ type: 'fetch', url: 'https://a.nexon.com/x', method: 'GET' });
    expect(!r.ok && r.code).toBe('DISCONNECTED');
    expect(!r.ok && r.data).toBeUndefined();
  });
});
