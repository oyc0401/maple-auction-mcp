import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getCharacterStats,
  type CharacterStatsSource,
} from './characterStats.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getCharacterStats', () => {
  it('API를 호출하지 않고 외부에서 받은 원본 응답만 CharacterStats로 조립한다', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const stats = getCharacterStats({
      stat: {
        character_class: '카데나',
        final_stat: [
          { stat_name: 'AP 배분 LUK', stat_value: '1000' },
          { stat_name: 'AP 배분 DEX', stat_value: '100' },
          { stat_name: 'AP 배분 STR', stat_value: '100' },
        ],
      },
      basic: {
        character_level: 270,
        character_guild_name: null,
        world_name: '스카니아',
      },
      equipment: {
        item_equipment: [
          {
            item_equipment_slot: '무기',
            item_name: '테스트 체인',
            item_total_option: {
              luk: '100',
              attack_power: '500',
              boss_damage: '30',
            },
            potential_option_1: '공격력 +12%',
            potential_option_2: null,
            potential_option_3: null,
            additional_potential_option_1: null,
            additional_potential_option_2: null,
            additional_potential_option_3: null,
            soul_option: null,
          },
        ],
        title: null,
      },
      setEffect: { set_effect: [] },
      symbol: { symbol: [] },
      hyper: {
        use_preset_no: 1,
        hyper_stat_preset_1: [],
      },
      ability: { ability_info: [] },
      union: {
        union_raider_stat: [],
        union_occupied_stat: [],
        union_state_stat: [],
      },
      artifact: { union_artifact_effect: [] },
      champion: { union_champion: [] },
      propensity: {
        charisma_level: 0,
        sensibility_level: 0,
        insight_level: 0,
        willingness_level: 0,
        handicraft_level: 0,
        charm_level: 0,
      },
      hexa: { character_hexa_stat_core: [] },
      cash: { cash_item_equipment_base: [] },
      link: { character_link_skill: [] },
      guild: null,
      skills: {
        '0': { character_skill: [] },
        '1': { character_skill: [] },
        '2': { character_skill: [] },
        '3': { character_skill: [] },
        '4': { character_skill: [] },
        hyperPassive: { character_skill: [] },
        hyperActive: { character_skill: [] },
        '5': { character_skill: [] },
      },
    } as unknown as CharacterStatsSource);

    if (stats instanceof Promise) void stats.catch(() => undefined);
    expect(stats).not.toBeInstanceOf(Promise);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(stats.AP).toMatchObject({ LUK: 1000, DEX: 100, STR: 100 });
    expect(stats.장비?.무기).toEqual({
      name: '테스트 체인',
      stat: {
        LUK: 100,
        공격력: 500,
        보공: 30,
        공격력퍼: 12,
      },
    });
  });
});
