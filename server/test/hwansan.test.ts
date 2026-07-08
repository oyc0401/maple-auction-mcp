import { describe, it, expect } from 'vitest';
import { resolveStatModel } from '../src/hwansan/jobs.js';
import { contributionFromRawItem, hwansanDiff, damageMultiplier, type CharState } from '../src/hwansan/calc.js';

// 원본 매물 형태 헬퍼: toolTip.stat + 잠재/에디 entries
const rawItem = (stat: Record<string, number>, pot: string[] = [], add: string[] = []) => ({
  toolTip: {
    stat,
    upgradeInfo: {
      potential: { entries: pot.map((text) => ({ text })) },
      additionalPotential: { entries: add.map((text) => ({ text })) },
    },
  },
});

describe('resolveStatModel', () => {
  it('LUK 도적(카데나·듀블·섀도어)은 LUK주/DEX부', () => {
    const s = { STR: 2189, DEX: 3718, INT: 2325, LUK: 34617 };
    expect(resolveStatModel('카데나', s)).toEqual({ kind: 'standard', main: 'LUK', sub: 'DEX' });
    expect(resolveStatModel('섀도어', s)).toEqual({ kind: 'standard', main: 'LUK', sub: 'DEX' });
  });

  it('전사=STR/DEX, 마법사=INT/LUK, 궁수=DEX/STR', () => {
    expect(resolveStatModel('히어로', { STR: 40000, DEX: 2500, INT: 800, LUK: 1000 }).kind).toBe('standard');
    expect(resolveStatModel('비숍', { STR: 1000, DEX: 1500, INT: 38000, LUK: 3000 })).toMatchObject({ main: 'INT', sub: 'LUK' });
    expect(resolveStatModel('보우마스터', { STR: 2500, DEX: 39000, INT: 900, LUK: 1200 })).toMatchObject({ main: 'DEX', sub: 'STR' });
  });

  it('제논=xenon, 데몬어벤져=hp 모델', () => {
    expect(resolveStatModel('제논', { STR: 15000, DEX: 15000, INT: 1000, LUK: 15000 })).toEqual({ kind: 'xenon' });
    expect(resolveStatModel('데몬어벤져', { STR: 1000, DEX: 900, INT: 800, LUK: 700 })).toEqual({ kind: 'hp' });
  });
});

describe('contributionFromRawItem 파싱', () => {
  it('stat 수치 + 잠재/에디 entries %를 합산한다', () => {
    const c = contributionFromRawItem(
      rawItem(
        { str: 0, dex: 269, int: 24, luk: 311, all: 0, pad: 762, mad: 0, mhp: 255, dam: 6, bdr: 30, imdr: 20 },
        ['공격력 +12%', '보스 몬스터 데미지 +40%', '몬스터 방어율 무시 +30%'],
        ['공격력 +12%', '공격력 +9%', '올스탯 +3%']
      )
    );
    expect(c.luk).toBe(311);
    expect(c.atk).toBe(762);
    expect(c.atkPct).toBe(33); // 12+12+9
    expect(c.dmgBoss).toBe(76); // 데미지6 + 보공(30 base + 40 잠재)
    expect(c.allPct).toBe(3);
    expect(c.idaFactor).toBeCloseTo(0.56, 5); // (1-0.2)(1-0.3)
  });
});

describe('hwansanDiff 부호 (표준 LUK)', () => {
  const state: CharState = {
    model: { kind: 'standard', main: 'LUK', sub: 'DEX' },
    str: 0, dex: 3000, int: 0, luk: 30000, hp: 40000, level: 270,
    attack: 2500, damageBossSum: 300, ignoreDef: 85, critRate: 100, critDamage: 120, finalDamage: 0,
  };
  const cur = contributionFromRawItem(rawItem({ luk: 200, dex: 100, pad: 500, bdr: 30, imdr: 20 }, ['보스 몬스터 데미지 +30%', '몬스터 방어율 무시 +30%', '공격력 +9%']));

  it('상위 무기는 양수', () => {
    const better = contributionFromRawItem(rawItem({ luk: 300, dex: 150, pad: 760, bdr: 30, imdr: 20, dam: 6 }, ['공격력 +12%', '보스 몬스터 데미지 +40%', '몬스터 방어율 무시 +30%'], ['공격력 +12%', '공격력 +9%']));
    expect(hwansanDiff(state, cur, better, false)).toBeGreaterThan(0);
  });

  it('하위 무기(0성·잠재없음)는 음수', () => {
    const worse = contributionFromRawItem(rawItem({ luk: 150, dex: 80, pad: 280, bdr: 30, imdr: 20 }));
    expect(hwansanDiff(state, cur, worse, false)).toBeLessThan(0);
  });

  it('같은 무기면 0', () => {
    expect(hwansanDiff(state, cur, cur, false)).toBeCloseTo(0, 6);
  });
});

describe('특수 직업 모델 (방향 판별)', () => {
  it('제논(xenon): 3스탯 무기가 강해지면 양수', () => {
    const state: CharState = {
      model: { kind: 'xenon' }, str: 20000, dex: 20000, int: 500, luk: 20000, hp: 40000, level: 270,
      attack: 2500, damageBossSum: 300, ignoreDef: 85, critRate: 100, critDamage: 120, finalDamage: 0,
    };
    const cur = contributionFromRawItem(rawItem({ pad: 400, bdr: 30, imdr: 20, all: 0 }));
    const better = contributionFromRawItem(rawItem({ pad: 700, bdr: 30, imdr: 20, all: 5 }, ['공격력 +12%', '보스 몬스터 데미지 +40%']));
    expect(damageMultiplier(state)).toBeGreaterThan(0);
    expect(hwansanDiff(state, cur, better, false)).toBeGreaterThan(0);
  });

  it('데몬어벤져(hp): HP·공 높은 무기가 양수', () => {
    const state: CharState = {
      model: { kind: 'hp' }, str: 1000, dex: 900, int: 800, luk: 700, hp: 800000, level: 270,
      attack: 2500, damageBossSum: 300, ignoreDef: 85, critRate: 100, critDamage: 120, finalDamage: 0,
    };
    const cur = contributionFromRawItem(rawItem({ pad: 400, mhp: 3000, bdr: 30, imdr: 20 }));
    const better = contributionFromRawItem(rawItem({ pad: 700, mhp: 8000, bdr: 30, imdr: 20 }, ['공격력 +12%', '보스 몬스터 데미지 +40%']));
    expect(damageMultiplier(state)).toBeGreaterThan(0);
    expect(hwansanDiff(state, cur, better, false)).toBeGreaterThan(0);
  });
});
