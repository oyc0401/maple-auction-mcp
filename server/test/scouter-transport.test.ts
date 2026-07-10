import { describe, it, expect, vi } from 'vitest';
import {
  SCOUTER_BLOCKED_MSG,
  SCOUTER_EXT_OUTDATED_MSG,
  DISCONNECTED_MSG,
  type BridgeReply,
  type BridgeCommandInput,
} from '@maple/shared';
import { bridgeScouterFetch, scouterErrorText } from '../src/scouterTransport.js';
import type { BridgeLike } from '../src/nexon.js';
import { fetchScouter, clearScouterCache } from '../src/hwansan2/scouterClient.js';

// 요청을 기록하고 지정한 응답을 돌려주는 가짜 브리지.
function fakeBridge(reply: BridgeReply): BridgeLike & { calls: BridgeCommandInput[] } {
  const calls: BridgeCommandInput[] = [];
  return {
    connected: true,
    calls,
    async request(cmd: BridgeCommandInput) {
      calls.push(cmd);
      return reply;
    },
  };
}

describe('bridgeScouterFetch — scouter 호출을 브리지(확장)로 우회', () => {
  it('GET을 브리지로 보내고 헤더를 그대로 싣는다', async () => {
    const b = fakeBridge({ id: '1', ok: true, status: 200, data: { boss380_stat: 42 } });
    const f = bridgeScouterFetch(b);
    const res = await f('https://api.maplescouter.com/api/id?name=x', {
      headers: { 'api-key': 'k' },
    } as any);
    expect(res.ok).toBe(true);
    expect(await res.json()).toEqual({ boss380_stat: 42 });
    expect(b.calls[0]).toMatchObject({
      type: 'fetch',
      url: 'https://api.maplescouter.com/api/id?name=x',
      method: 'GET',
      headers: { 'api-key': 'k' },
    });
  });

  it('POST body(JSON 문자열)를 객체로 되돌려 브리지에 싣는다', async () => {
    const b = fakeBridge({ id: '1', ok: true, status: 200, data: { boss380_stat: 1 } });
    const f = bridgeScouterFetch(b);
    await f('https://api.maplescouter.com/api/calc/dmg-simulator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userStat: {}, simulator: { mainStat: '0' } }),
    } as any);
    expect(b.calls[0]).toMatchObject({ method: 'POST', body: { userStat: {}, simulator: { mainStat: '0' } } });
  });

  it('HTTP 403(HTTP_ERROR)은 던지지 않고 !ok Response로 돌려준다 (scouterClient가 status로 판단)', async () => {
    const b = fakeBridge({ id: '1', ok: false, code: 'HTTP_ERROR', status: 403, error: 'HTTP 403', data: null });
    const res = await bridgeScouterFetch(b)('https://api.maplescouter.com/api/id?name=x');
    expect(res.ok).toBe(false);
    expect(res.status).toBe(403);
  });

  it('전송 실패(DISCONNECTED/FORBIDDEN_URL)는 예외로 던진다', async () => {
    const disc = fakeBridge({ id: '', ok: false, code: 'DISCONNECTED', error: '미연결' });
    await expect(bridgeScouterFetch(disc)('https://api.maplescouter.com/api/id')).rejects.toThrow('DISCONNECTED');
    const forbidden = fakeBridge({ id: '1', ok: false, code: 'FORBIDDEN_URL', error: '허용되지 않은 URL: ...' });
    await expect(bridgeScouterFetch(forbidden)('https://api.maplescouter.com/api/id')).rejects.toThrow('FORBIDDEN_URL');
  });
});

describe('scouterErrorText — 실패를 AI 행동 지시로 변환', () => {
  it('403은 Cloudflare 차단 안내로 매핑한다', () => {
    expect(scouterErrorText(new Error('scouter /api/id 403'))).toBe(SCOUTER_BLOCKED_MSG);
  });
  it('FORBIDDEN_URL(구버전 확장)은 확장 업데이트 안내로 매핑한다', () => {
    expect(scouterErrorText(new Error('FORBIDDEN_URL: 허용되지 않은 URL'))).toBe(SCOUTER_EXT_OUTDATED_MSG);
  });
  it('DISCONNECTED는 확장 미연결 안내로 매핑한다', () => {
    expect(scouterErrorText(new Error('DISCONNECTED: 미연결'))).toBe(DISCONNECTED_MSG);
  });
  it('그 외 오류는 원문을 감싼다', () => {
    expect(scouterErrorText(new Error('boom'))).toContain('boom');
  });
});

describe('fetchScouter × bridgeScouterFetch 통합', () => {
  it('브리지 성공 응답을 파싱해 반환한다', async () => {
    clearScouterCache();
    const b = fakeBridge({ id: '1', ok: true, status: 200, data: { calculatedData: { boss380_stat: 30371 }, userStat: {}, userEquipData: [] } });
    const d = await fetchScouter('오유찬', { fetchFn: bridgeScouterFetch(b) });
    expect(d.calculatedData.boss380_stat).toBe(30371);
  });
  it('브리지 CF 403 → scouterClient가 던지고 → scouterErrorText가 CF 안내로 변환', async () => {
    clearScouterCache();
    const b = fakeBridge({ id: '1', ok: false, code: 'HTTP_ERROR', status: 403, error: 'HTTP 403', data: null });
    const err = await fetchScouter('막힌캐릭', { fetchFn: bridgeScouterFetch(b) }).catch((e) => e);
    expect(scouterErrorText(err)).toBe(SCOUTER_BLOCKED_MSG);
  });
});
