import type {
  CharacterStat,
  ItemEquipment,
  ItemEquipmentRes,
  ItemOption,
  SetEffectRes,
} from '../../nexon/index.js';
import type { GearStats, StatBlock } from '../stat-interface.js';

const num = (v: unknown): number => Number(v ?? 0) || 0;

// 잠재/세트/소울 효과줄은 값이 이미 박혀 있고 "이름 +N(%)" 꼴이라 템플릿 DB로는 퍼/깡 구분이 안 된다.
// 레거시 apply/accumPlus를 StatBlock 출력으로 계승한다(딜 무관 스탯은 무시).
const MAIN: Record<string, 'STR' | 'DEX' | 'INT' | 'LUK'> = {
  STR: 'STR',
  DEX: 'DEX',
  INT: 'INT',
  LUK: 'LUK',
  힘: 'STR',
  민첩: 'DEX',
  민첩성: 'DEX',
  지력: 'INT',
  지능: 'INT',
  운: 'LUK',
  행운: 'LUK',
};

function add(block: StatBlock, key: keyof StatBlock, val: number): void {
  if (key === '방무' || key === '최종뎀') {
    (block[key] ??= []).push(val);
    return;
  }
  const b = block as Record<string, number | undefined>;
  b[key] = (b[key] ?? 0) + val;
}

function applyNamed(
  block: StatBlock,
  rawName: string,
  val: number,
  pct: boolean
): void {
  const name = rawName.replace(/\s*:\s*$/, '').trim(); // "몬스터 방어율 무시 :" 후행 콜론 제거
  const main = MAIN[name];
  if (main) {
    add(block, pct ? (`${main}퍼` as keyof StatBlock) : main, val);
    return;
  }
  switch (name) {
    case '올스탯':
      add(block, pct ? '올스탯퍼' : '올스탯', val);
      break;
    case '최대 HP':
      add(block, pct ? 'HP퍼' : 'HP', val);
      break;
    case '공격력':
      add(block, pct ? '공격력퍼' : '공격력', val);
      break;
    case '마력':
      add(block, pct ? '마력퍼' : '마력', val);
      break;
    case '공격력과 마력':
    case '공격력/마력':
      add(block, pct ? '공격력퍼' : '공격력', val);
      add(block, pct ? '마력퍼' : '마력', val);
      break;
    case '데미지':
      if (pct) add(block, '데미지', val);
      break;
    case '추가뎀':
    case '상태 이상에 걸린 대상 공격 시 데미지':
    case '상태 이상에 걸린 몬스터 공격 시 데미지':
      if (pct) add(block, '추가뎀', val);
      break;
    case '보스 몬스터 데미지':
    case '보스 데미지':
    case '보스 몬스터 공격 시 데미지':
    case '보스 몬스터 공격 시 데미지 증가':
      if (pct) add(block, '보공', val);
      break;
    case '몬스터 방어율 무시':
    case '방어율 무시':
      if (pct) add(block, '방무', val);
      break;
    case '최종 데미지':
      if (pct) add(block, '최종뎀', val);
      break;
    case '크리티컬 확률':
      if (pct) add(block, '크확', val);
      break;
    case '크리티컬 데미지':
      if (pct) add(block, '크뎀', val);
      break;
    default:
      break;
  }
}

const RE_PLUS = /^(.+?)\s*\+\s*(-?\d+(?:\.\d+)?)\s*(%?)$/;
const RE_PER_LEVEL =
  /캐릭터 기준\s*(\d+)레벨 당\s*(.+?)\s*\+\s*(\d+(?:\.\d+)?)/;

// "이름 +N(%)" 효과줄(잠재·세트·소울·칭호) → block. 레벨당 옵션은 캐릭터 레벨로 환산.
function parsePlusLine(
  block: StatBlock,
  line: string | null | undefined,
  level: number
): void {
  if (!line) return;
  const per = line.match(RE_PER_LEVEL);
  if (per) {
    const step = Math.floor(level / Number(per[1])) * Number(per[3]);
    applyNamed(block, per[2], step, false);
    return;
  }
  for (const seg of line.split(',')) {
    const m = seg.trim().match(RE_PLUS);
    if (m) applyNamed(block, m[1], Number(m[2]), m[3] === '%');
  }
}

// item_total_option = base+add+etc+starforce+scroll의 합(잠재 제외). 깡스탯·정형 %만 직접 반영.
function collectTotalOption(block: StatBlock, t: ItemOption): void {
  const put = (key: keyof StatBlock, v: number) => {
    if (v) add(block, key, v);
  };
  put('STR', num(t.str));
  put('DEX', num(t.dex));
  put('INT', num(t.int));
  put('LUK', num(t.luk));
  put('올스탯퍼', num(t.all_stat));
  put('HP', num(t.max_hp));
  put('공격력', num(t.attack_power));
  put('마력', num(t.magic_power));
  put('보공', num(t.boss_damage));
  put('데미지', num(t.damage));
  put('방무', num(t.ignore_monster_armor));
}

const POTENTIAL_KEYS = [
  'potential_option_1',
  'potential_option_2',
  'potential_option_3',
  'additional_potential_option_1',
  'additional_potential_option_2',
  'additional_potential_option_3',
] as const;

function gearItemBlock(item: ItemEquipment, level: number): StatBlock {
  const block: StatBlock = {};
  collectTotalOption(block, item.item_total_option);
  for (const k of POTENTIAL_KEYS) parsePlusLine(block, item[k], level);
  parsePlusLine(block, item.soul_option, level);
  return block;
}

const GEAR_SLOTS = new Set<string>([
  '모자',
  '얼굴장식',
  '눈장식',
  '귀고리',
  '상의',
  '하의',
  '신발',
  '장갑',
  '망토',
  '무기',
  '보조무기',
  '엠블렘',
  '반지1',
  '반지2',
  '반지3',
  '반지4',
  '펜던트',
  '펜던트2',
  '벨트',
  '어깨장식',
  '포켓아이템',
  '훈장',
  '뱃지',
  '기계심장',
  '칭호',
]);

// 장비 → 부위별 StatBlock. 슬롯명은 공백만 제거하면 GearStats 키와 1:1(포켓 아이템·기계 심장).
export function getGear(equip: ItemEquipmentRes, level: number): GearStats {
  const gear: GearStats = {};
  for (const item of equip.item_equipment ?? []) {
    const key = item.item_equipment_slot.replace(/\s+/g, '');
    if (!GEAR_SLOTS.has(key)) continue;
    const block = gearItemBlock(item, level);
    if (Object.keys(block).length > 0) gear[key as keyof GearStats] = block;
  }
  const title: StatBlock = {};
  const desc = equip.title?.title_description;
  if (desc) for (const line of desc.split(/[,\n]/)) parsePlusLine(title, line, level);
  if (Object.keys(title).length > 0) gear.칭호 = title;
  return gear;
}

// 보스 세트류는 부위 수 상한이 있어 total_set_count가 넘쳐도 상한까지만 인정(레거시 계승).
const SET_CAP: Array<[prefix: string, max: number]> = [['도전자의 장비 세트', 7]];

// 세트효과 → 세트명별 StatBlock. set_option_full은 카운트별 "증분"이라 활성 카운트 이하 티어를 누산한다.
export function getSet(setEffect: SetEffectRes): Record<string, StatBlock> {
  const result: Record<string, StatBlock> = {};
  for (const s of setEffect.set_effect ?? []) {
    const cap = SET_CAP.find(([p]) => s.set_name.startsWith(p))?.[1];
    const total = num(s.total_set_count);
    const count = cap != null ? Math.min(total, cap) : total;
    const block: StatBlock = {};
    for (const tier of s.set_option_full ?? []) {
      if (num(tier.set_count) <= count) parsePlusLine(block, tier.set_option, 0);
    }
    if (Object.keys(block).length > 0) result[s.set_name] = block;
  }
  return result;
}

// AP 배분 스탯 → StatBlock. final_stat의 "AP 배분 *"만 뽑는다.
const AP_LINES: Array<[name: string, key: keyof StatBlock]> = [
  ['AP 배분 STR', 'STR'],
  ['AP 배분 DEX', 'DEX'],
  ['AP 배분 INT', 'INT'],
  ['AP 배분 LUK', 'LUK'],
  ['AP 배분 HP', 'HP'],
];
export function getAP(stat: CharacterStat): StatBlock {
  const block: StatBlock = {};
  for (const [name, key] of AP_LINES) {
    const line = stat.final_stat.find((s) => s.stat_name === name);
    const v = num(line?.stat_value);
    if (v) add(block, key, v);
  }
  return block;
}
