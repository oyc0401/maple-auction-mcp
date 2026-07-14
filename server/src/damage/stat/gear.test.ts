import { describe, expect, it } from 'vitest';
import type {
  CharacterStat,
  ItemEquipment,
  ItemEquipmentRes,
  ItemOption,
  SetEffectRes,
} from '../../nexon/index.js';
import { getAP, getGear, getSet } from './gear.js';

const ZERO: ItemOption = {
  str: '0',
  dex: '0',
  int: '0',
  luk: '0',
  max_hp: '0',
  max_mp: '0',
  attack_power: '0',
  magic_power: '0',
};

function item(part: string, over: Partial<ItemEquipment>): ItemEquipment {
  return {
    item_equipment_part: part,
    item_equipment_slot: part,
    item_name: '',
    item_icon: '',
    item_description: null,
    item_shape_name: '',
    item_shape_icon: '',
    item_gender: null,
    item_total_option: ZERO,
    item_base_option: ZERO,
    potential_option_grade: null,
    additional_potential_option_grade: null,
    potential_option_flag: '',
    potential_option_1: null,
    potential_option_2: null,
    potential_option_3: null,
    additional_potential_option_flag: '',
    additional_potential_option_1: null,
    additional_potential_option_2: null,
    additional_potential_option_3: null,
    equipment_level_increase: 0,
    item_exceptional_option: ZERO,
    item_add_option: ZERO,
    growth_exp: 0,
    growth_level: 0,
    scroll_upgrade: '0',
    cuttable_count: '0',
    golden_hammer_flag: '',
    scroll_resilience_count: '0',
    scroll_upgradeable_count: '0',
    soul_name: null,
    soul_option: null,
    item_etc_option: ZERO,
    starforce: '0',
    starforce_scroll_flag: '',
    item_starforce_option: ZERO,
    special_ring_level: 0,
    date_expire: null,
    freestyle_flag: '',
    ...over,
  };
}

function equipRes(items: ItemEquipment[]): ItemEquipmentRes {
  return {
    date: null,
    character_gender: '',
    character_class: '',
    preset_no: 1,
    item_equipment: items,
    item_equipment_preset_1: [],
    item_equipment_preset_2: [],
    item_equipment_preset_3: [],
    // biome-ignore lint/suspicious/noExplicitAny: 테스트에선 title만 채운다
    title: null as any,
    // biome-ignore lint/suspicious/noExplicitAny: 미사용
    title_preset1: null as any,
    // biome-ignore lint/suspicious/noExplicitAny: 미사용
    title_preset2: null as any,
    // biome-ignore lint/suspicious/noExplicitAny: 미사용
    title_preset3: null as any,
    dragon_equipment: [],
    mechanic_equipment: [],
    medal_shape: null,
  };
}

describe('getGear — 부위별 StatBlock', () => {
  it('total_option 깡스탯 + 잠재/소울 %줄을 부위별로 합친다', () => {
    const weapon = item('무기', {
      item_total_option: {
        ...ZERO,
        str: '349',
        dex: '457',
        attack_power: '997',
        boss_damage: '42',
        ignore_monster_armor: '20',
        all_stat: '4',
      },
      potential_option_1: '공격력 +13%',
      potential_option_2: '보스 몬스터 데미지 +45%',
      additional_potential_option_1: '공격력 +10%',
      soul_option: '공격력 +3%',
    });
    const gear = getGear(equipRes([weapon]), 285);
    expect(gear.무기).toEqual({
      STR: 349,
      DEX: 457,
      공격력: 997,
      보공: 42 + 45,
      방무: [20],
      올스탯퍼: 4,
      공격력퍼: 13 + 10 + 3,
    });
  });

  it('슬롯명 공백 제거로 GearStats 키에 매핑한다(포켓 아이템)', () => {
    const pocket = item('포켓 아이템', {
      item_equipment_slot: '포켓 아이템',
      item_total_option: { ...ZERO, attack_power: '30' },
    });
    const gear = getGear(equipRes([pocket]), 285);
    expect(gear.포켓아이템).toEqual({ 공격력: 30 });
  });
});

describe('getSet — 활성 카운트 이하 티어 누산', () => {
  it('total_set_count 이하 티어만 더하고 콜론형 방무도 반영한다', () => {
    const setEffect: SetEffectRes = {
      date: null,
      set_effect: [
        {
          set_name: '광휘의 보스 세트',
          total_set_count: 3,
          set_effect_info: [],
          set_option_full: [
            { set_count: 2, set_option: '올스탯  +20, 보스 몬스터 데미지 +15%' },
            {
              set_count: 3,
              set_option: '올스탯  +20, 몬스터 방어율 무시 : +15%',
            },
            { set_count: 4, set_option: '올스탯  +20, 크리티컬 데미지 +5%' },
          ],
        },
      ],
    };
    // 3세트: 티어 2·3 누산(4는 제외). 올스탯 20+20, 보공 15, 방무 [15].
    expect(getSet(setEffect)['광휘의 보스 세트']).toEqual({
      올스탯: 40,
      보공: 15,
      방무: [15],
    });
  });
});

describe('getAP — final_stat의 AP 배분만', () => {
  it('AP 배분 주스탯을 뽑는다', () => {
    const stat: CharacterStat = {
      date: null,
      character_class: '',
      remain_ap: 0,
      final_stat: [
        { stat_name: 'AP 배분 STR', stat_value: '4' },
        { stat_name: 'AP 배분 DEX', stat_value: '1498' },
        { stat_name: 'AP 배분 HP', stat_value: '0' },
        { stat_name: '공격력', stat_value: '16617' },
      ],
    };
    expect(getAP(stat)).toEqual({ STR: 4, DEX: 1498 });
  });
});
