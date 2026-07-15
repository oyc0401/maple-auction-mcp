import { describe, expect, it } from 'vitest';
import type { ItemEquipmentRes } from '../nexon/index.js';
import { getStatsAfterEquipmentReplacement } from './equipmentReplacement.js';
import { getFinalDamageChangeRate } from './finalDamage.js';
import type { CharacterStats } from './stat-interface.js';

describe('getStatsAfterEquipmentReplacement', () => {
  it('앱솔랩스 4세트 장비를 일반 장비로 바꾸면 3세트 효과로 내려간다', () => {
    const stats: CharacterStats = {
      기본: {},
      AP: {},
      장비: {
        모자: { STR: 100 },
        상의: { STR: 100 },
        신발: { STR: 100 },
        망토: { STR: 100 },
      },
      세트효과: {
        '앱솔랩스 세트(전사)': {
          올스탯: 30,
          공격력: 65,
          마력: 65,
          보공: 20,
          방무: [10],
        },
      },
    };
    const current = {
      stats,
      equipment: {
        item_equipment: [
          {
            item_equipment_slot: '모자',
            item_name: '앱솔랩스 나이트헬름',
          },
          {
            item_equipment_slot: '상의',
            item_name: '앱솔랩스 나이트슈트',
          },
          {
            item_equipment_slot: '신발',
            item_name: '앱솔랩스 나이트슈즈',
          },
          {
            item_equipment_slot: '망토',
            item_name: '앱솔랩스 나이트케이프',
          },
        ],
      } as ItemEquipmentRes,
    };

    const changed = getStatsAfterEquipmentReplacement(current, {
      slot: '신발',
      name: '일반 신발',
      stats: { STR: 200 },
    });

    expect(changed.장비?.신발).toEqual({ STR: 200 });
    expect(changed.세트효과).toEqual({
      앱솔랩스: {
        올스탯: 30,
        공격력: 40,
        마력: 40,
        보공: 20,
      },
    });
    expect(stats.장비?.신발).toEqual({ STR: 100 });
    expect(stats.세트효과?.['앱솔랩스 세트(전사)']?.공격력).toBe(65);
  });

  it('새 아이템 이름으로 세트를 판별해 3세트에서 4세트까지 올라간다', () => {
    const current = {
      stats: {
        기본: {},
        AP: {},
        장비: { 신발: { DEX: 10 } },
        세트효과: {},
      } satisfies CharacterStats,
      equipment: {
        item_equipment: [
          {
            item_equipment_slot: '모자',
            item_name: '앱솔랩스 나이트헬름',
          },
          {
            item_equipment_slot: '상의',
            item_name: '앱솔랩스 나이트슈트',
          },
          {
            item_equipment_slot: '망토',
            item_name: '앱솔랩스 나이트케이프',
          },
          { item_equipment_slot: '신발', item_name: '일반 신발' },
        ],
      } as ItemEquipmentRes,
    };

    const changed = getStatsAfterEquipmentReplacement(current, {
      slot: '신발',
      name: '앱솔랩스 나이트슈즈',
      stats: { STR: 200 },
    });

    expect(changed.세트효과).toEqual({
      앱솔랩스: {
        올스탯: 30,
        공격력: 65,
        마력: 65,
        보공: 20,
        방무: [10],
      },
    });
  });

  it('앱솔 2피스에서 3피스가 되면 럭키 아이템이 발동해 4세트가 된다', () => {
    const current = {
      stats: { 기본: {}, AP: {}, 장비: {}, 세트효과: {} },
      equipment: {
        item_equipment: [
          {
            item_equipment_slot: '상의',
            item_name: '앱솔랩스 나이트슈트',
          },
          {
            item_equipment_slot: '망토',
            item_name: '앱솔랩스 나이트케이프',
          },
          { item_equipment_slot: '모자', item_name: '카오스 벨룸의 헬름' },
          { item_equipment_slot: '신발', item_name: '일반 신발' },
        ],
      } as ItemEquipmentRes,
    };

    const changed = getStatsAfterEquipmentReplacement(current, {
      slot: '신발',
      name: '앱솔랩스 나이트슈즈',
      stats: {},
    });

    expect(changed.세트효과?.앱솔랩스).toEqual({
      올스탯: 30,
      공격력: 65,
      마력: 65,
      보공: 20,
      방무: [10],
    });
  });

  it('럭키 아이템을 일반 장비로 바꾸면 4세트에서 3세트로 내려간다', () => {
    const current = {
      stats: { 기본: {}, AP: {}, 장비: {}, 세트효과: {} },
      equipment: {
        item_equipment: [
          {
            item_equipment_slot: '상의',
            item_name: '앱솔랩스 나이트슈트',
          },
          {
            item_equipment_slot: '망토',
            item_name: '앱솔랩스 나이트케이프',
          },
          {
            item_equipment_slot: '신발',
            item_name: '앱솔랩스 나이트슈즈',
          },
          { item_equipment_slot: '모자', item_name: '카오스 벨룸의 헬름' },
        ],
      } as ItemEquipmentRes,
    };

    const changed = getStatsAfterEquipmentReplacement(current, {
      slot: '모자',
      name: '일반 모자',
      stats: {},
    });

    expect(changed.세트효과?.앱솔랩스).toEqual({
      올스탯: 30,
      공격력: 40,
      마력: 40,
      보공: 20,
    });
  });

  it('DB에서 지원하지 않는 기존 세트효과는 그대로 보존한다', () => {
    const current = {
      stats: {
        기본: {},
        AP: {},
        장비: { 신발: { STR: 10 } },
        세트효과: { '이벤트 세트': { 공격력: 5 } },
      } satisfies CharacterStats,
      equipment: {
        item_equipment: [
          { item_equipment_slot: '신발', item_name: '일반 신발' },
        ],
      } as ItemEquipmentRes,
    };

    const changed = getStatsAfterEquipmentReplacement(current, {
      slot: '신발',
      name: '다른 일반 신발',
      stats: { STR: 20 },
    });

    expect(changed.세트효과).toEqual({
      '이벤트 세트': { 공격력: 5 },
    });
  });

  it('생성한 CharacterStats를 최종 데미지 증감률 계산에 바로 사용한다', () => {
    const stats: CharacterStats = {
      기본: { 공격력: 100, 방무: [100] },
      AP: { STR: 1000, DEX: 100 },
      장비: { 신발: { STR: 100 } },
      세트효과: {
        '앱솔랩스 세트(전사)': {
          올스탯: 30,
          공격력: 65,
          마력: 65,
          보공: 20,
          방무: [10],
        },
      },
    };
    const current = {
      stats,
      equipment: {
        item_equipment: [
          {
            item_equipment_slot: '모자',
            item_name: '앱솔랩스 나이트헬름',
          },
          {
            item_equipment_slot: '상의',
            item_name: '앱솔랩스 나이트슈트',
          },
          {
            item_equipment_slot: '신발',
            item_name: '앱솔랩스 나이트슈즈',
          },
          {
            item_equipment_slot: '망토',
            item_name: '앱솔랩스 나이트케이프',
          },
        ],
      } as ItemEquipmentRes,
    };
    const changed = getStatsAfterEquipmentReplacement(current, {
      slot: '신발',
      name: '일반 신발',
      stats: { STR: 100 },
    });

    expect(
      getFinalDamageChangeRate({ job: '히어로', level: 300, stats }, changed)
    ).toBeLessThan(0);
  });
});
