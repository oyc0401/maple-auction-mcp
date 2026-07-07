import { describe, it, expect } from 'vitest';
import { resolveStatModel } from '../src/hwansan/jobs.js';
import { contributionFromAuction, hwansanDiff, type SpecTotals } from '../src/hwansan/calc.js';

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

  it('제논·데몬어벤져는 미지원으로 감지', () => {
    expect(resolveStatModel('제논', { STR: 15000, DEX: 15000, INT: 1000, LUK: 15000 }).kind).toBe('unsupported');
    expect(resolveStatModel('데몬어벤져', { STR: 1000, DEX: 900, INT: 800, LUK: 700 }).kind).toBe('unsupported');
  });
});

describe('contributionFromAuction 파싱', () => {
  it('finalStat 수치 + 잠재/에디 %를 합산한다', () => {
    const item = {
      finalStat: { str: 0, dex: 269, int: 24, luk: 311, all: 0, pad: 762, mad: 0, mhp: 255, dam: 6, bdr: 30, imdr: 20 },
      potential: '레전드리: 공격력 +12% / 보스 몬스터 데미지 +40% / 몬스터 방어율 무시 +30%',
      additional: '레전드리: 공격력 +12% / 공격력 +9% / 올스탯 +3%',
    };
    const c = contributionFromAuction(item, 'LUK', false);
    expect(c.main).toBe(311); // LUK
    expect(c.atk).toBe(762); // finalStat.pad
    expect(c.atkPct).toBe(33); // 12+12+9
    expect(c.dmgBoss).toBe(76); // 데미지6 + 보공(30 base + 40 잠재)
    expect(c.mainPct).toBe(3); // 올스탯 3
    // 방무: base 20 × 잠재 30 → (1-0.2)(1-0.3)=0.56
    expect(c.idaFactor).toBeCloseTo(0.56, 5);
  });
});

describe('hwansanDiff 부호', () => {
  const base: SpecTotals = {
    main: 30000, sub: 3000, attack: 2500, damageBossSum: 300,
    ignoreDef: 85, critRate: 100, critDamage: 120, finalDamage: 0,
  };
  const cur = contributionFromAuction(
    { finalStat: { luk: 200, dex: 100, pad: 500, bdr: 30, imdr: 20, str: 0, int: 0, mad: 0, all: 0, dam: 0, mhp: 0 },
      potential: '레전드리: 보스 몬스터 데미지 +30% / 몬스터 방어율 무시 +30% / 공격력 +9%', additional: null },
    'LUK', false
  );

  it('상위 무기(고성·좋은 잠재)는 양수', () => {
    const better = contributionFromAuction(
      { finalStat: { luk: 300, dex: 150, pad: 760, bdr: 30, imdr: 20, str: 0, int: 0, mad: 0, all: 0, dam: 6, mhp: 0 },
        potential: '레전드리: 공격력 +12% / 보스 몬스터 데미지 +40% / 몬스터 방어율 무시 +30%', additional: '레전드리: 공격력 +12% / 공격력 +9%' },
      'LUK', false
    );
    expect(hwansanDiff(base, cur, better)).toBeGreaterThan(0);
  });

  it('하위 무기(0성·잠재없음)는 음수', () => {
    const worse = contributionFromAuction(
      { finalStat: { luk: 150, dex: 80, pad: 280, bdr: 30, imdr: 20, str: 0, int: 0, mad: 0, all: 0, dam: 0, mhp: 0 },
        potential: null, additional: null },
      'LUK', false
    );
    expect(hwansanDiff(base, cur, worse)).toBeLessThan(0);
  });

  it('같은 무기면 0', () => {
    expect(hwansanDiff(base, cur, cur)).toBeCloseTo(0, 6);
  });
});
