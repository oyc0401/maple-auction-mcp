import { describe, it, expect } from 'vitest';
import { resolveStatModel } from '../src/hwansan/jobs.js';
import { contributionFromRawItem, contributionFromEquip, hwansanDiff, damageMultiplier, type CharState } from '../src/hwansan/calc.js';
import { setBaseOfItem, setSwapDelta, comboSetDelta, normalizeSet } from '../src/hwansan/sets.js';
import { slotLabel, slotFromLabel, categoryToSlots } from '../src/hwansan/slots.js';

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

describe('contributionFromEquip 파싱 (넥슨 오픈 API)', () => {
  it('item_total_option 수치 + potential/additional 잠재 %를 합산한다 ("이름 : +값%" 콜론 포맷)', () => {
    const c = contributionFromEquip({
      item_total_option: {
        str: '0', dex: '269', int: '24', luk: '311', max_hp: '255', all_stat: '0',
        attack_power: '762', magic_power: '0', damage: '6', boss_damage: '30', ignore_monster_armor: '20',
      },
      potential_option_1: '공격력 : +12%',
      potential_option_2: '보스 몬스터 데미지 : +40%',
      potential_option_3: '몬스터 방어율 무시 : +30%',
      additional_option_1: '공격력 : +12%',
      additional_option_2: '공격력 : +9%',
      additional_option_3: '올스탯 : +3%',
    });
    expect(c.luk).toBe(311);
    expect(c.atk).toBe(762);
    expect(c.atkPct).toBe(33); // 12+12+9 — 콜론 포맷 잠재가 파싱되지 않으면 0이 되어 실패
    expect(c.dmgBoss).toBe(76); // damage 6 + boss(30 고정 + 40 잠재)
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

describe('세트 델타', () => {
  it('아이템명 → 세트 base 추론 (방어구 세트만)', () => {
    expect(setBaseOfItem('앱솔랩스 시프슈즈')).toBe('앱솔랩스');
    expect(setBaseOfItem('에테르넬 나이트메어')).toBe('에테르넬');
    expect(setBaseOfItem('이글아이 어새신셔츠')).toBeNull(); // 비세트 이벤트템
  });

  it('세트명 정규화: 직업 변형 접미사 제거', () => {
    expect(normalizeSet('앱솔랩스 세트(도적)')).toBe('앱솔랩스');
    expect(normalizeSet('칠흑의 보스 세트')).toBe('칠흑의 보스');
    expect(normalizeSet(null)).toBeNull();
  });

  it('같은 세트 유지 교체는 변화 없음', () => {
    const d = setSwapDelta({ 앱솔랩스: 5 }, '앱솔랩스', '앱솔랩스');
    expect(d.atk).toBe(0);
    expect(d.dmgBoss).toBe(0);
  });

  it('앱솔 5셋 부위를 다른 세트로 교체하면 앱솔 5셋 옵션(공30·보공10%) 손실', () => {
    const d = setSwapDelta({ 앱솔랩스: 5 }, '앱솔랩스', '아케인셰이드');
    expect(d.atk).toBe(-30); // 공격력 +30 손실
    expect(d.matk).toBe(-30);
    expect(d.dmgBoss).toBe(-10); // 보스 몬스터 데미지 +10% 손실
  });

  it('조합: 여러 피스로 세트 완성 시 다단계 누적 (에테르넬 0→4셋)', () => {
    const changes = Array.from({ length: 4 }, () => ({ oldSet: null, newSet: '에테르넬' }));
    const d = comboSetDelta({}, changes);
    // 에테르넬 2셋(공40) + 3셋(공40,올50) + 4셋(공40) = 공120, 올스탯50, 보공30
    expect(d.atk).toBe(120);
    expect(d.allStat).toBe(50);
    expect(d.dmgBoss).toBe(30);
  });

  it('조합: 아케인셰이드 여러 부위로 세트 완성 (0→4셋 = 보공+30·방무+10·공+65·올+50)', () => {
    const changes = Array.from({ length: 4 }, () => ({ oldSet: null, newSet: '아케인셰이드' }));
    const d = comboSetDelta({}, changes);
    expect(d.atk).toBe(95); // 2셋 공30 + 3셋 공30 + 4셋 공35
    expect(d.dmgBoss).toBe(20); // 2셋 보공10 + 4셋 보공10
    expect(d.allStat).toBe(50); // 4셋 올50
  });

  it('조합: 세트 여러 피스 동시 파괴 (앱솔 5→3셋 = 4·5셋 손실)', () => {
    const d = comboSetDelta({ 앱솔랩스: 5 }, [
      { oldSet: '앱솔랩스', newSet: null },
      { oldSet: '앱솔랩스', newSet: null },
    ]);
    expect(d.atk).toBe(-55); // 4셋(공25) + 5셋(공30) 손실
    expect(d.dmgBoss).toBe(-10); // 5셋 보공10% 손실
  });
});

describe('부위명 (다부위 슬롯 명시)', () => {
  it('반지는 4슬롯, 펜던트는 2슬롯', () => {
    expect(categoryToSlots('ARMOR_ACCESSORY_RING')).toEqual(['반지1', '반지2', '반지3', '반지4']);
    expect(categoryToSlots('ARMOR_ACCESSORY_PENDANT')).toEqual(['펜던트', '펜던트2']);
  });

  it('펜던트 첫 슬롯은 표시용으로 펜던트1, 나머지는 그대로', () => {
    expect(slotLabel('펜던트')).toBe('펜던트1');
    expect(slotLabel('펜던트2')).toBe('펜던트2');
    expect(slotLabel('반지3')).toBe('반지3');
    expect(slotLabel('무기')).toBe('무기');
  });

  it('slotFromLabel은 표시용 라벨을 넥슨 슬롯키로 역변환 (compare_combo 입력 파싱)', () => {
    expect(slotFromLabel('펜던트1')).toBe('펜던트'); // 입력 "펜던트1:id" → 실제 슬롯 "펜던트"
    expect(slotFromLabel('펜던트2')).toBe('펜던트2');
    expect(slotFromLabel('반지2')).toBe('반지2');
    // slotLabel ↔ slotFromLabel 라운드트립
    for (const s of ['무기', '펜던트', '펜던트2', '반지1', '반지4', '모자']) {
      expect(slotFromLabel(slotLabel(s))).toBe(s);
    }
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
