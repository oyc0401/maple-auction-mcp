import type {
  ItemEquipment,
  ItemEquipmentRes,
  ItemOption,
} from '../../nexon/index.js';
import { getEquipmentSlot } from '../equipmentSlot.js';
import type { GearStats, StatBlock } from '../stat-interface.js';

const POTENTIAL_KEYS = [
  'potential_option_1',
  'potential_option_2',
  'potential_option_3',
  'additional_potential_option_1',
  'additional_potential_option_2',
  'additional_potential_option_3',
] as const;

function numberValue(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function add(block: StatBlock, key: keyof StatBlock, value: number): void {
  if (!Number.isFinite(value) || value === 0) return;
  if (key === '방무' || key === '최종뎀') {
    block[key] = [...(block[key] ?? []), value];
    return;
  }

  const values = block as Record<string, number | undefined>;
  values[key] = (values[key] ?? 0) + value;
}

function applyNamedOption(
  block: StatBlock,
  rawName: string,
  value: number,
  percent: boolean
): void {
  const name = rawName.replace(/\s*:\s*$/, '').trim();

  if (name === 'STR' || name === 'DEX' || name === 'INT' || name === 'LUK') {
    add(block, percent ? `${name}퍼` : name, value);
    return;
  }

  switch (name) {
    case '올스탯':
      add(block, percent ? '올스탯퍼' : '올스탯', value);
      break;
    case '최대 HP':
      add(block, percent ? 'HP퍼' : 'HP', value);
      break;
    case '공격력':
      add(block, percent ? '공격력퍼' : '공격력', value);
      break;
    case '마력':
      add(block, percent ? '마력퍼' : '마력', value);
      break;
    case '공격력/마력':
    case '공격력과 마력':
      add(block, percent ? '공격력퍼' : '공격력', value);
      add(block, percent ? '마력퍼' : '마력', value);
      break;
    case '데미지':
      if (percent) add(block, '데미지', value);
      break;
    case '보스 몬스터 데미지':
    case '보스 몬스터 공격 시 데미지':
      if (percent) add(block, '보공', value);
      break;
    case '몬스터 방어율 무시':
    case '방어율 무시':
      if (percent) add(block, '방무', value);
      break;
    case '최종 데미지':
      if (percent) add(block, '최종뎀', value);
      break;
    case '크리티컬 확률':
      if (percent) add(block, '크확', value);
      break;
    case '크리티컬 데미지':
      if (percent) add(block, '크뎀', value);
      break;
    case '상태 이상에 걸린 대상 공격 시 데미지':
    case '상태 이상에 걸린 몬스터 공격 시 데미지':
      if (percent) add(block, '추가뎀', value);
      break;
    default:
      break;
  }
}

function parseOptionText(
  block: StatBlock,
  text: string | null | undefined,
  characterLevel: number
): void {
  if (!text) return;

  for (const source of text.split(/[,\n]/)) {
    const line = source.trim();
    if (!line) continue;

    const perLevel =
      /^캐릭터 기준\s*(\d+)레벨 당\s*(STR|DEX|INT|LUK)\s*\+\s*(\d+(?:\.\d+)?)$/.exec(
        line
      );
    if (perLevel) {
      const levelStep = Number(perLevel[1]);
      if (levelStep > 0) {
        add(
          block,
          perLevel[2] as 'STR' | 'DEX' | 'INT' | 'LUK',
          Math.floor(characterLevel / levelStep) * Number(perLevel[3])
        );
      }
      continue;
    }

    const option = /^(.+?)\s*([+-])\s*(\d+(?:\.\d+)?)\s*(%|초)?$/.exec(line);
    if (!option) continue;

    const [, name, sign, rawValue, unit] = option;
    const value = Number(rawValue) * (sign === '-' ? -1 : 1);
    if (name.trim() === '스킬 재사용 대기시간' && unit === '초') {
      if (value < 0) add(block, '쿨감', -value);
      continue;
    }

    applyNamedOption(block, name, value, unit === '%');
  }
}

function collectTotalOption(block: StatBlock, option: ItemOption): void {
  add(block, 'STR', numberValue(option.str));
  add(block, 'DEX', numberValue(option.dex));
  add(block, 'INT', numberValue(option.int));
  add(block, 'LUK', numberValue(option.luk));
  add(block, 'HP', numberValue(option.max_hp));
  add(block, 'HP퍼', numberValue(option.max_hp_rate));
  add(block, '공격력', numberValue(option.attack_power));
  add(block, '마력', numberValue(option.magic_power));
  add(block, '올스탯퍼', numberValue(option.all_stat));
  add(block, '데미지', numberValue(option.damage));
  add(block, '보공', numberValue(option.boss_damage));
  add(block, '방무', numberValue(option.ignore_monster_armor));
}

export function getItemStats(
  item: ItemEquipment,
  characterLevel: number
): StatBlock {
  const block: StatBlock = {};
  collectTotalOption(block, item.item_total_option);
  for (const key of POTENTIAL_KEYS) {
    parseOptionText(block, item[key], characterLevel);
  }
  parseOptionText(block, item.soul_option, characterLevel);
  return block;
}

export function getGear(
  equipment: ItemEquipmentRes,
  characterLevel: number
): GearStats {
  const gear: GearStats = {};

  for (const item of equipment.item_equipment ?? []) {
    const slot = getEquipmentSlot(item.item_equipment_slot);
    if (!slot) continue;

    const block = getItemStats(item, characterLevel);
    if (Object.keys(block).length > 0) gear[slot] = block;
  }

  const title: StatBlock = {};
  parseOptionText(title, equipment.title?.title_description, characterLevel);
  if (Object.keys(title).length > 0) gear.칭호 = title;

  return gear;
}
