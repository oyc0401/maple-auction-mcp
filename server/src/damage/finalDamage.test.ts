import { describe, expect, it } from 'vitest';
import {
  type CharacterDamageContext,
  getFinalDamageChangeRate,
} from './finalDamage.js';
import type { CharacterStats, StatBlock } from './stat-interface.js';

function characterStats(block: StatBlock): CharacterStats {
  return {
    기본: block,
    AP: {},
  };
}

function context(job: string, stats: CharacterStats): CharacterDamageContext {
  return {
    job,
    level: 300,
    stats,
  };
}

describe('getFinalDamageChangeRate', () => {
  it('두 번째 파라미터의 변경 후 공격력을 최종 데미지 증감률로 반환한다', () => {
    const before = characterStats({
      STR: 100,
      DEX: 25,
      공격력: 100,
      방무: [90],
    });
    const after = characterStats({
      STR: 100,
      DEX: 25,
      공격력: 110,
      방무: [90],
    });

    expect(getFinalDamageChangeRate(context('히어로', before), after)).toBe(10);
  });

  it('INT 직업은 공격력이 아니라 마력 변화를 사용한다', () => {
    const before = characterStats({
      INT: 100,
      LUK: 25,
      공격력: 100,
      마력: 100,
      방무: [90],
    });
    const after = characterStats({
      INT: 100,
      LUK: 25,
      공격력: 200,
      마력: 100,
      방무: [90],
    });

    expect(
      getFinalDamageChangeRate(context('아크메이지(불,독)', before), after)
    ).toBe(0);
  });

  it('방무는 보스 방어율 380% 기준으로 독립 곱연산한다', () => {
    const before = characterStats({
      STR: 100,
      DEX: 25,
      공격력: 100,
      방무: [90],
    });
    const after = characterStats({
      STR: 100,
      DEX: 25,
      공격력: 100,
      방무: [90, 20],
    });

    expect(getFinalDamageChangeRate(context('히어로', before), after)).toBe(
      12.26
    );
  });

  it('최종 데미지는 배열의 각 항목을 서로 곱한다', () => {
    const before = characterStats({
      STR: 100,
      DEX: 25,
      공격력: 100,
      방무: [90],
      최종뎀: [10],
    });
    const after = characterStats({
      STR: 100,
      DEX: 25,
      공격력: 100,
      방무: [90],
      최종뎀: [10, 20],
    });

    expect(getFinalDamageChangeRate(context('히어로', before), after)).toBe(20);
  });

  it('중첩된 스탯 소스와 메이플 용사 AP 증가량을 합산한다', () => {
    const before: CharacterStats = {
      기본: { 공격력: 100, 방무: [90] },
      AP: { STR: 100, DEX: 25 },
      메이플용사: 10,
      장비: {
        모자: { name: '모자', stat: { STR퍼: 100 } },
      },
    };
    const after: CharacterStats = {
      ...before,
      장비: {
        ...before.장비,
        무기: { name: '무기', stat: { 공격력퍼: 10 } },
      },
    };

    expect(getFinalDamageChangeRate(context('히어로', before), after)).toBe(10);
  });

  it('제논과 데몬어벤져의 전용 스탯 축을 적용한다', () => {
    const xenonBefore = characterStats({
      STR: 100,
      DEX: 100,
      LUK: 100,
      공격력: 100,
      방무: [90],
    });
    const xenonAfter = characterStats({
      STR: 110,
      DEX: 100,
      LUK: 100,
      공격력: 100,
      방무: [90],
    });
    const devenBefore = characterStats({
      STR: 100,
      HP: 3500,
      공격력: 100,
      방무: [90],
    });
    const devenAfter = characterStats({
      STR: 100,
      HP: 3850,
      공격력: 100,
      방무: [90],
    });

    expect(
      getFinalDamageChangeRate(context('제논', xenonBefore), xenonAfter)
    ).toBe(3.33);
    expect(
      getFinalDamageChangeRate(context('데몬어벤져', devenBefore), devenAfter)
    ).toBe(9.76);
  });
});
