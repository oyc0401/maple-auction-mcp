import { describe, expect, it } from 'vitest';
import type {
  EquipmentTitle,
  ItemEquipment,
  ItemEquipmentRes,
  ItemOption,
} from '../../nexon/index.js';
import { getGear } from './gear.js';

const ZERO_OPTION: ItemOption = {
  str: '0',
  dex: '0',
  int: '0',
  luk: '0',
  max_hp: '0',
  max_mp: '0',
  attack_power: '0',
  magic_power: '0',
};

function equipmentItem(
  slot: string,
  overrides: Partial<ItemEquipment> = {}
): ItemEquipment {
  return {
    item_equipment_part: slot,
    item_equipment_slot: slot,
    item_name: '',
    item_icon: '',
    item_description: null,
    item_shape_name: '',
    item_shape_icon: '',
    item_gender: null,
    item_total_option: ZERO_OPTION,
    item_base_option: ZERO_OPTION,
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
    item_exceptional_option: ZERO_OPTION,
    item_add_option: ZERO_OPTION,
    growth_exp: 0,
    growth_level: 0,
    scroll_upgrade: '0',
    cuttable_count: '0',
    golden_hammer_flag: '',
    scroll_resilience_count: '0',
    scroll_upgradeable_count: '0',
    soul_name: null,
    soul_option: null,
    item_etc_option: ZERO_OPTION,
    starforce: '0',
    starforce_scroll_flag: '',
    item_starforce_option: ZERO_OPTION,
    special_ring_level: 0,
    date_expire: null,
    freestyle_flag: '',
    ...overrides,
  };
}

function equipmentResponse(
  items: ItemEquipment[],
  title: EquipmentTitle | null = null
): ItemEquipmentRes {
  const emptyTitle = title as EquipmentTitle;
  return {
    date: null,
    character_gender: '',
    character_class: '',
    preset_no: 1,
    item_equipment: items,
    item_equipment_preset_1: [],
    item_equipment_preset_2: [],
    item_equipment_preset_3: [],
    title: emptyTitle,
    title_preset1: emptyTitle,
    title_preset2: emptyTitle,
    title_preset3: emptyTitle,
    dragon_equipment: [],
    mechanic_equipment: [],
    medal_shape: null,
  };
}

describe('getGear', () => {
  it('장비 총 옵션과 잠재·에디·소울을 슬롯별로 합산한다', () => {
    const weapon = equipmentItem('무기', {
      item_total_option: {
        ...ZERO_OPTION,
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
      additional_potential_option_2: '캐릭터 기준 9레벨 당 STR +2',
      soul_option: '공격력 +3%',
    });

    expect(getGear(equipmentResponse([weapon]), 285).무기).toEqual({
      STR: 411,
      DEX: 457,
      공격력: 997,
      보공: 87,
      방무: [20],
      올스탯퍼: 4,
      공격력퍼: 26,
    });
  });

  it('쿨감과 공백이 있는 API 슬롯명 및 칭호 옵션을 변환한다', () => {
    const hat = equipmentItem('모자', {
      potential_option_1: '스킬 재사용 대기시간 -2초',
      potential_option_2: '스킬 재사용 대기시간 -2초',
      additional_potential_option_1: '스킬 재사용 대기시간 -1초',
    });
    const pocket = equipmentItem('포켓 아이템', {
      item_total_option: { ...ZERO_OPTION, attack_power: '30' },
    });
    const heart = equipmentItem('기계 심장', {
      item_total_option: { ...ZERO_OPTION, magic_power: '20' },
    });
    const title = {
      title_name: 'SWEET WISH',
      title_icon: null,
      title_description:
        '보스 몬스터 데미지 +30%\n몬스터 방어율 무시+30%\n공격력/마력+30',
      date_expire: null,
      date_option_expire: null,
      title_shape_name: null,
      title_shape_icon: null,
      title_shape_description: null,
    };

    expect(
      getGear(equipmentResponse([hat, pocket, heart], title), 285)
    ).toEqual({
      모자: { 쿨감: 5 },
      포켓아이템: { 공격력: 30 },
      기계심장: { 마력: 20 },
      칭호: {
        보공: 30,
        방무: [30],
        공격력: 30,
        마력: 30,
      },
    });
  });

  it('현재 적용 장비가 아닌 예비 특수 반지는 제외한다', () => {
    const reserveRing = equipmentItem('예비 특수 반지', {
      item_total_option: { ...ZERO_OPTION, str: '100' },
    });

    expect(getGear(equipmentResponse([reserveRing]), 285)).toEqual({});
  });
});
