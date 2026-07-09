import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fetchScouter, baseSimulator, clearScouterCache } from '../src/hwansan2/scouterClient.js';
import { parseOptionLine } from '../src/hwansan2/optionDict.js';
import { fromScouterEquip, fromAuctionRaw, statAxes, toSimulatorDelta, emptyItemStats } from '../src/hwansan2/axes.js';
import { countSets, setSwapStats, setBaseOfItem } from '../src/hwansan2/sets.js';

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

describe('optionDict', () => {
  it('실측 문구를 축으로 매핑한다', () => {
    expect(parseOptionLine('몬스터 방어율 무시 +40%')).toEqual({ key: 'ied', val: 40, pct: true });
    expect(parseOptionLine('보스 몬스터 데미지 +35%')).toEqual({ key: 'boss', val: 35, pct: true });
    expect(parseOptionLine('올스탯 +3%')).toEqual({ key: 'allStat', val: 3, pct: true });
    expect(parseOptionLine('공격력 +9%')).toEqual({ key: 'atk', val: 9, pct: true });
    expect(parseOptionLine('DEX +14')).toEqual({ key: 'DEX', val: 14, pct: false });
    expect(parseOptionLine('스킬 재사용 대기시간 -2초')).toEqual({ key: 'coolSec', val: 2, pct: false });
    expect(parseOptionLine('공격 시 7% 확률로 오토스틸')).toEqual({ unknown: '공격 시 7% 확률로 오토스틸' });
    expect(parseOptionLine('')).toBeNull();
  });
});

describe('axes', () => {
  const equips = idResponse.userEquipData;
  it('fromScouterEquip: 무기 잠재·소울·분해옵션을 ItemStats로', () => {
    const w = equips.find((e: any) => e.slot === '무기');
    const s = fromScouterEquip(w);
    expect(s.atk).toBe(Number(w.totalOption.attack_power)); // 실측 649 (base+add+etc+starforce 합)
    expect(s.dmgBoss).toBe(Number(w.totalOption.boss_damage) + Number(w.totalOption.damage) + 30 + 35 + 7); // 고정+잠재 보공30/35+소울7
    expect(s.iedFactor).toBeCloseTo((1 - Number(w.totalOption.ignore_monster_armor) / 100) * (1 - 0.4), 10);
    expect(s.atkPct).toBe(9 + 6); // 에디 공9%+6%
    expect(s.allPct).toBe(3);
    expect(s.unknown).toEqual([]);
  });
  it('statAxes: 카데나 = LUK 주스탯, 이중부스탯(DEX=sub, STR=ssub), 물리', () => {
    const ax = statAxes(idResponse.userStat)!;
    expect(ax).toMatchObject({ main: 'LUK', sub: 'DEX', ssub: 'STR', isMagic: false });
  });
  it('toSimulatorDelta: 동일 아이템이면 null(전 축 0)', () => {
    const ax = statAxes(idResponse.userStat)!;
    for (const e of equips) {
      const s = fromScouterEquip(e);
      expect(toSimulatorDelta(s, s, emptyItemStats(), ax, 93.9669)).toBeNull();
    }
  });
  it('toSimulatorDelta: 깡스탯·%·방무 차이를 올바른 축에 싣는다', () => {
    const ax = statAxes(idResponse.userStat)!;
    const cur = emptyItemStats();
    const next = { ...emptyItemStats(), flat: { STR: 10, DEX: 20, INT: 0, LUK: 100 }, pct: { STR: 0, DEX: 0, INT: 0, LUK: 12 }, iedFactor: 1 - 0.3, dmgBoss: 30, coolSec: 2 };
    const sim = toSimulatorDelta(cur, next, emptyItemStats(), ax, 90)!;
    expect(sim.mainStat).toBe('100');
    expect(sim.subStat).toBe('20');
    expect(sim.ssubStat).toBe('10');
    expect(sim.mainStatPer).toBe('12');
    expect(sim.bossDmg).toBe('30');
    expect(sim.coolTimeReduce).toBe('2');
    // 방무: 실방무 90% 기준, (1-0.9)에 (1-0.3) 곱 → 93% → 델타 +3
    expect(Number(sim.ignoreGuard)).toBeCloseTo(3, 6);
  });
  it('toSimulatorDelta: 현재 아이템 방무 100%(iedFactor 0)여도 NaN 없이 계산된다', () => {
    const ax = statAxes(idResponse.userStat)!;
    const cur = { ...emptyItemStats(), iedFactor: 0 };
    const next = { ...emptyItemStats(), flat: { STR: 1, DEX: 0, INT: 0, LUK: 0 } };
    const sim = toSimulatorDelta(cur, next, emptyItemStats(), ax, 90)!;
    expect(Number.isFinite(Number(sim.ignoreGuard))).toBe(true);
  });
});

describe('sets', () => {
  const names = idResponse.userEquipData.map((e: any) => e.name);
  it('countSets: 카데나 장비에서 아케인셰이드 피스를 센다', () => {
    const counts = countSets(names);
    expect(counts['아케인셰이드']).toBeGreaterThanOrEqual(1); // 무기 포함
  });
  it('럭키 아이템: 3피스 이상 모든 세트에 +1, 1개만 적용', () => {
    const counts = countSets(['아케인셰이드 체인', '아케인셰이드 슈트', '아케인셰이드 숄더', '카오스 벨룸의 헬름']);
    expect(counts['아케인셰이드']).toBe(4); // 3피스 + 카벨모자 럭키 +1
  });
  it('setSwapStats: 앱솔 4→3 파괴 델타는 음수 방향', () => {
    const counts = { 앱솔랩스: 4 };
    const d = setSwapStats(counts, '앱솔랩스', null);
    expect(d.atk).toBeLessThan(0); // 4셋 옵션 상실
  });
  it('setBaseOfItem: 이름 추론', () => {
    expect(setBaseOfItem('앱솔랩스 나이트케이프')).toBe('앱솔랩스');
    expect(setBaseOfItem('스칼렛 링')).toBeNull(); // 장신구 세트는 추론 제외(럭키 판정과 별개)
  });
  it('럭키 아이템 2개 착용해도 +1은 한 번만', () => {
    const counts = countSets(['아케인셰이드 체인', '아케인셰이드 슈트', '아케인셰이드 숄더', '카오스 벨룸의 헬름', '스칼렛 링']);
    expect(counts['아케인셰이드']).toBe(4); // +2가 아니라 +1
  });
  it('럭키 +1은 3피스 이상인 모든 세트에 동시 적용, 2피스엔 미적용', () => {
    const counts = countSets(['아케인셰이드 체인', '아케인셰이드 슈트', '아케인셰이드 숄더', '앱솔랩스 케이프', '앱솔랩스 슈즈', '카오스 벨룸의 헬름']);
    expect(counts['아케인셰이드']).toBe(4);
    expect(counts['앱솔랩스']).toBe(2); // 3피스 미만이라 럭키 미적용
  });
});
