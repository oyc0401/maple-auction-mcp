export type NexonDate = string | null;

export interface OcidRes {
  ocid: string;
}

export interface StatLine {
  stat_name: string;
  stat_value: string;
}

export interface CharacterStat {
  date: NexonDate;
  character_class: string;
  final_stat: StatLine[];
  remain_ap: number;
}

export interface CharacterBasic {
  date: NexonDate;
  character_name: string;
  world_name: string;
  character_gender: string;
  character_class: string;
  character_class_level: string;
  character_level: number;
  character_exp: number;
  character_exp_rate: string;
  character_guild_name: string | null;
  character_image: string;
  character_date_create: string;
  access_flag: string;
  liberation_quest_clear: string;
}

export interface ItemOption {
  str: string;
  dex: string;
  int: string;
  luk: string;
  max_hp: string;
  max_mp: string;
  attack_power: string;
  magic_power: string;
  armor?: string;
  speed?: string;
  jump?: string;
  boss_damage?: string;
  ignore_monster_armor?: string;
  all_stat?: string;
  damage?: string;
  max_hp_rate?: string;
  max_mp_rate?: string;
  base_equipment_level?: number;
  equipment_level_decrease?: number;
  exceptional_upgrade?: number;
}

export interface ItemEquipment {
  item_equipment_part: string;
  item_equipment_slot: string;
  item_name: string;
  item_icon: string;
  item_description: string | null;
  item_shape_name: string;
  item_shape_icon: string;
  item_gender: string | null;
  item_total_option: ItemOption;
  item_base_option: ItemOption;
  potential_option_grade: string | null;
  additional_potential_option_grade: string | null;
  potential_option_flag: string;
  potential_option_1: string | null;
  potential_option_2: string | null;
  potential_option_3: string | null;
  additional_potential_option_flag: string;
  additional_potential_option_1: string | null;
  additional_potential_option_2: string | null;
  additional_potential_option_3: string | null;
  equipment_level_increase: number;
  item_exceptional_option: ItemOption;
  item_add_option: ItemOption;
  growth_exp: number;
  growth_level: number;
  scroll_upgrade: string;
  cuttable_count: string;
  golden_hammer_flag: string;
  scroll_resilience_count: string;
  scroll_upgradeable_count: string;
  soul_name: string | null;
  soul_option: string | null;
  item_etc_option: ItemOption;
  starforce: string;
  starforce_scroll_flag: string;
  item_starforce_option: ItemOption;
  special_ring_level: number;
  date_expire: NexonDate;
  freestyle_flag: string;
}

export interface EquipmentTitle {
  title_name: string | null;
  title_icon: string | null;
  title_description: string | null;
  date_expire: NexonDate;
  date_option_expire: NexonDate;
  title_shape_name: string | null;
  title_shape_icon: string | null;
  title_shape_description: string | null;
  preset_no?: number;
  disable_flag?: string;
}

export interface MedalShape {
  medal_shape_name: string;
  medal_shape_icon: string;
  medal_shape_description: string;
  medal_shape_changed_name: string;
  medal_shape_changed_icon: string;
  medal_shape_changed_description: string;
}

export interface ItemEquipmentRes {
  date: NexonDate;
  character_gender: string;
  character_class: string;
  preset_no: number;
  item_equipment: ItemEquipment[];
  item_equipment_preset_1: ItemEquipment[];
  item_equipment_preset_2: ItemEquipment[];
  item_equipment_preset_3: ItemEquipment[];
  title: EquipmentTitle;
  title_preset1: EquipmentTitle;
  title_preset2: EquipmentTitle;
  title_preset3: EquipmentTitle;
  dragon_equipment: unknown[];
  mechanic_equipment: unknown[];
  medal_shape: MedalShape | null;
}

export interface SetEffectOption {
  set_count: number;
  set_option: string;
}

export interface SetEffect {
  set_name: string;
  total_set_count: number;
  set_effect_info: SetEffectOption[];
  set_option_full: SetEffectOption[];
}

export interface SetEffectRes {
  date: NexonDate;
  set_effect: SetEffect[];
}

export interface SymbolLine {
  symbol_name: string;
  symbol_icon: string;
  symbol_description: string;
  symbol_other_effect_description: string | null;
  symbol_force: string;
  symbol_level: number;
  symbol_str: string;
  symbol_dex: string;
  symbol_int: string;
  symbol_luk: string;
  symbol_hp: string;
  symbol_drop_rate: string;
  symbol_meso_rate: string;
  symbol_exp_rate: string;
  symbol_growth_count: number;
  symbol_require_growth_count: number;
}

export interface SymbolEquipmentRes {
  date: NexonDate;
  character_class: string;
  symbol: SymbolLine[];
}

export interface HyperStatLine {
  stat_type: string;
  stat_point: number | null;
  stat_level: number;
  stat_increase: string | null;
}

export interface HyperStatRes {
  date: NexonDate;
  character_class: string;
  use_preset_no: string;
  use_available_hyper_stat: number;
  hyper_stat_preset_1: HyperStatLine[];
  hyper_stat_preset_1_remain_point: number;
  hyper_stat_preset_2: HyperStatLine[];
  hyper_stat_preset_2_remain_point: number;
  hyper_stat_preset_3: HyperStatLine[];
  hyper_stat_preset_3_remain_point: number;
}

export interface AbilityLine {
  ability_no: string;
  ability_grade: string;
  ability_value: string;
}

export interface AbilityPreset {
  ability_preset_grade: string;
  ability_info: AbilityLine[];
}

export interface AbilityRes {
  date: NexonDate;
  ability_grade: string;
  ability_info: AbilityLine[];
  remain_fame: number;
  preset_no: number;
  ability_preset_1: AbilityPreset;
  ability_preset_2: AbilityPreset;
  ability_preset_3: AbilityPreset;
}

export interface SkillEntry {
  skill_name: string;
  skill_description: string;
  skill_level: number;
  skill_effect: string | null;
  skill_icon: string;
  skill_effect_next?: string | null;
}

export interface LinkSkillRes {
  date: NexonDate;
  character_class: string;
  character_link_skill: SkillEntry[];
  character_link_skill_preset_1: SkillEntry[];
  character_link_skill_preset_2: SkillEntry[];
  character_link_skill_preset_3: SkillEntry[];
  character_owned_link_skill: SkillEntry;
  character_owned_link_skill_preset_1: SkillEntry;
  character_owned_link_skill_preset_2: SkillEntry;
  character_owned_link_skill_preset_3: SkillEntry;
}

export interface PropensityRes {
  date: NexonDate;
  charisma_level: number;
  sensibility_level: number;
  insight_level: number;
  willingness_level: number;
  handicraft_level: number;
  charm_level: number;
}

export type SkillGrade = '0' | '1' | '2' | '3' | '4' | '5' | 'hyperpassive';

export interface SkillRes {
  date?: NexonDate;
  character_class?: string;
  character_skill_grade?: string;
  character_skill: SkillEntry[];
}

export interface HexaStatCore {
  slot_id: string;
  main_stat_name: string | null;
  sub_stat_name_1: string | null;
  sub_stat_name_2: string | null;
  main_stat_level: number;
  sub_stat_level_1: number;
  sub_stat_level_2: number;
  stat_grade: number;
}

export interface HexaMatrixStatRes {
  date: NexonDate;
  character_class: string;
  character_hexa_stat_core: HexaStatCore[];
  character_hexa_stat_core_2: HexaStatCore[];
  character_hexa_stat_core_3: HexaStatCore[];
  preset_hexa_stat_core: HexaStatCore[];
  preset_hexa_stat_core_2: HexaStatCore[];
  preset_hexa_stat_core_3: HexaStatCore[];
}

export interface CashItemOption {
  option_type: string;
  option_value: string;
}

export interface CashItemEquipment {
  cash_item_equipment_part: string;
  cash_item_equipment_slot: string;
  cash_item_name: string;
  cash_item_icon: string;
  cash_item_description: string | null;
  cash_item_option: CashItemOption[];
  date_expire: NexonDate;
  date_option_expire: NexonDate;
  cash_item_label: string | null;
  cash_item_coloring_prism: unknown | null;
  cash_item_effect_prism: unknown | null;
  item_gender: string | null;
  skills: unknown[];
  freestyle_flag: string;
  emotion_name: string | null;
}

export interface CashItemEquipmentRes {
  date: NexonDate;
  character_gender: string;
  character_class: string;
  character_look_mode: string;
  preset_no: number | null;
  cash_item_equipment_base: CashItemEquipment[];
  cash_item_equipment_preset_1: CashItemEquipment[];
  cash_item_equipment_preset_2: CashItemEquipment[];
  cash_item_equipment_preset_3: CashItemEquipment[];
  additional_cash_item_equipment_base: unknown[];
  additional_cash_item_equipment_preset_1: unknown[];
  additional_cash_item_equipment_preset_2: unknown[];
  additional_cash_item_equipment_preset_3: unknown[];
}

export interface UnionStatePreset {
  preset_no: number;
  union_state_stat: string[];
}

export interface UnionRaiderRes {
  date: NexonDate;
  use_preset_no: number;
  union_raider_stat: string[];
  union_occupied_stat: unknown[];
  union_inner_stat: unknown[];
  union_block: unknown[];
  union_raider_preset_1: unknown | null;
  union_raider_preset_2: unknown | null;
  union_raider_preset_3: unknown | null;
  union_raider_preset_4: unknown | null;
  union_raider_preset_5: unknown | null;
  union_state_stat: string[];
  union_state_stat_preset: UnionStatePreset[];
  union_max_point: number | null;
}

export interface UnionArtifactCrystal {
  name: string;
  validity_flag: string;
  date_expire: string;
  level: number;
  crystal_option_name_1: string;
  crystal_option_name_2: string;
  crystal_option_name_3: string;
}

export interface UnionArtifactEffect {
  name: string;
  level: number;
}

export interface UnionArtifactRes {
  date: NexonDate;
  union_artifact_effect: UnionArtifactEffect[];
  union_artifact_crystal: UnionArtifactCrystal[];
  union_artifact_remain_ap: number | null;
}

export interface UnionChampion {
  champion_name: string;
  champion_slot: number;
  champion_grade: string;
  champion_class: string;
  champion_badge_info: UnionChampionBadge[];
}

export interface UnionChampionBadge {
  stat: string;
}

export interface UnionChampionRes {
  date: NexonDate;
  union_champion: UnionChampion[];
  champion_badge_total_info: UnionChampionBadge[];
}

export interface GuildIdRes {
  oguild_id: string;
}

export interface GuildSkill extends SkillEntry {
  skill_effect: string;
}

export interface GuildBasicRes {
  date: NexonDate;
  world_name: string;
  guild_name: string;
  guild_level: number;
  guild_fame: number;
  guild_point: number;
  guild_master_name: string;
  guild_member_count: number;
  guild_member: string[];
  guild_skill: GuildSkill[];
  guild_noblesse_skill: GuildSkill[];
}

export type SkillsByGrade = Partial<Record<SkillGrade, SkillEntry[]>>;
