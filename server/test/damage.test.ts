import { describe, expect, it } from 'vitest';
import { getStatsAfterEquipmentReplacement } from '../src/damage/equipmentReplacement.js';
import { getFinalDamageChangeRate } from '../src/damage/finalDamage.js';
import { getAuctionItemStats } from '../src/damage/stat/gear.js';
import type { CharacterStats } from '../src/damage/stat-interface.js';

describe('경매장 장비 StatBlock 변환', () => {
  it('툴팁 최종 스탯과 잠재·에디·소울을 하나의 StatBlock으로 변환한다', () => {
    const stat = getAuctionItemStats(
      {
        toolTip: {
          stat: {
            str: 10,
            luk: 100,
            pad: 20,
            bdr: 30,
            imdr: 10,
          },
          upgradeInfo: {
            potential: {
              grade: 4,
              description: '잠재능력 : 레전드리',
              entries: [
                { text: 'LUK +9%' },
                { text: '몬스터 방어율 무시 +10%' },
              ],
            },
            additionalPotential: {
              grade: 3,
              description: '에디셔널 잠재능력 : 유니크',
              entries: [{ text: '공격력 +6%' }],
            },
          },
          soulWeapon: {
            status: 'ENCHANTED',
            optionText: '보스 몬스터 데미지 +7%',
          },
        },
      },
      270
    );

    expect(stat).toEqual({
      STR: 10,
      LUK: 100,
      공격력: 20,
      보공: 37,
      방무: [10, 10],
      LUK퍼: 9,
      공격력퍼: 6,
    });
  });

  it('toolTip.stat에 포함된 추가옵션·익셉셔널 수치를 다시 더하지 않는다', () => {
    const stat = getAuctionItemStats(
      {
        toolTip: {
          stat: { str: 30, pad: 284 },
          exceptionalUpgrade: {
            entries: [{ text: 'STR +30' }, { text: '공격력 +15' }],
          },
          upgradeInfo: {
            exOption: {
              entries: [{ text: '공격력 +72' }],
            },
          },
        },
      },
      270
    );

    expect(stat).toEqual({ STR: 30, 공격력: 284 });
  });

  it('캐릭터 기준 9레벨당 스탯은 착용 캐릭터 레벨로 계산한다', () => {
    const stat = getAuctionItemStats(
      {
        toolTip: {
          stat: {},
          upgradeInfo: {
            additionalPotential: {
              grade: 2,
              description: '에디셔널 잠재능력 : 에픽',
              entries: [{ text: '캐릭터 기준 9레벨 당 LUK +2' }],
            },
          },
        },
      },
      270
    );

    expect(stat).toEqual({ 레벨당LUK: 2 });
  });
});

describe('경매장 장비 교체 최종 데미지 증감률', () => {
  it('현재 장비와 같은 스탯의 매물은 0%다', () => {
    const current: CharacterStats = {
      기본: { 공격력: 100, 방무: [100] },
      AP: { LUK: 1000, DEX: 100, STR: 100 },
      장비: {
        반지1: {
          name: '현재 링',
          stat: { LUK: 100, 공격력: 20, LUK퍼: 9, 방무: [10] },
        },
      },
      세트효과: {},
    };
    const replacement = getStatsAfterEquipmentReplacement(current, {
      slot: '반지1',
      name: '새 링',
      stat: { LUK: 100, 공격력: 20, LUK퍼: 9, 방무: [10] },
    });

    expect(
      getFinalDamageChangeRate(
        { job: '카데나', level: 270, stats: current },
        replacement
      )
    ).toBe(0);
  });

  it('더 강한 매물은 양수, 더 약한 매물은 음수다', () => {
    const current: CharacterStats = {
      기본: { 공격력: 100, 방무: [100] },
      AP: { LUK: 1000, DEX: 100, STR: 100 },
      장비: {
        반지1: { name: '현재 링', stat: { LUK: 100, 공격력: 20 } },
      },
      세트효과: {},
    };
    const stronger = getStatsAfterEquipmentReplacement(current, {
      slot: '반지1',
      name: '강한 링',
      stat: { LUK: 200, 공격력: 40 },
    });
    const weaker = getStatsAfterEquipmentReplacement(current, {
      slot: '반지1',
      name: '약한 링',
      stat: { LUK: 10 },
    });

    expect(
      getFinalDamageChangeRate(
        { job: '카데나', level: 270, stats: current },
        stronger
      )
    ).toBeGreaterThan(0);
    expect(
      getFinalDamageChangeRate(
        { job: '카데나', level: 270, stats: current },
        weaker
      )
    ).toBeLessThan(0);
  });

  it('현재 장비의 방무 잠재가 사라지면 증감률이 음수다', () => {
    const current: CharacterStats = {
      기본: { 공격력: 100, 방무: [90] },
      AP: { LUK: 1000, DEX: 100, STR: 100 },
      장비: {
        반지1: {
          name: '현재 링',
          stat: { LUK: 100, 공격력: 20, 방무: [20] },
        },
      },
      세트효과: {},
    };
    const replacement = getStatsAfterEquipmentReplacement(current, {
      slot: '반지1',
      name: '방무 없는 링',
      stat: { LUK: 100, 공격력: 20 },
    });

    expect(
      getFinalDamageChangeRate(
        { job: '카데나', level: 270, stats: current },
        replacement
      )
    ).toBeLessThan(0);
  });
});
