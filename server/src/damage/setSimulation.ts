import { SET_DB, type SetTier } from './setDb.js';
import type { StatBlock } from './stat-interface.js';

const NON_INFERABLE_SETS = new Set([
  '여명의 보스',
  '칠흑의 보스',
  '보스 장신구',
  '광휘의 보스',
]);

const INFERABLE_SETS = Object.keys(SET_DB)
  .filter((set) => !NON_INFERABLE_SETS.has(set))
  .sort((a, b) => b.length - a.length);

const SET_ALIASES: Array<[RegExp, string]> = [
  [/^(하이네스|이글아이|트릭스터|파프니르) /, '루타비스'],
];

const ACCESSORY_MEMBERS = new Map<string, string>([
  ['응축된 힘의 결정석', '보스 장신구'],
  ['블랙빈 마크', '보스 장신구'],
  ['아쿠아틱 레터 눈장식', '보스 장신구'],
  ['파풀라투스 마크', '보스 장신구'],
  ['데아 시두스 이어링', '보스 장신구'],
  ['골든 클로버 벨트', '보스 장신구'],
  ['매커네이터 펜던트', '보스 장신구'],
  ['도미네이터 펜던트', '보스 장신구'],
  ['핑크빛 성배', '보스 장신구'],
  ['크리스탈 웬투스 뱃지', '보스 장신구'],
  ['로얄 블랙메탈 숄더', '보스 장신구'],
  ['고귀한 이피아의 반지', '보스 장신구'],
  ['가디언 엔젤 링', '보스 장신구'],
  ['트와일라이트 마크', '보스 장신구'],
  ['에스텔라 이어링스', '보스 장신구'],
  ['데이브레이크 펜던트', '보스 장신구'],
  ['루즈 컨트롤 머신 마크', '칠흑의 보스'],
  ['마력이 깃든 안대', '칠흑의 보스'],
  ['몽환의 벨트', '칠흑의 보스'],
  ['고통의 근원', '칠흑의 보스'],
  ['창세의 뱃지', '칠흑의 보스'],
  ['커맨더 포스 이어링', '칠흑의 보스'],
  ['거대한 공포', '칠흑의 보스'],
  ['컴플리트 언더컨트롤', '칠흑의 보스'],
  ['근원의 속삭임', '광휘의 보스'],
  ['죽음의 맹세', '광휘의 보스'],
  ['불멸의 유산', '광휘의 보스'],
  ['황홀한 악몽', '광휘의 보스'],
  ['오만의 원죄', '광휘의 보스'],
  ['굶주리는 핏빛 원혼', '광휘의 보스'],
]);

const ACCESSORY_PATTERNS: Array<[RegExp, string]> = [
  [/^저주받은 .*마도서$/, '칠흑의 보스'],
  [/^미트라의 분노/, '칠흑의 보스'],
];

const DAWN_ITEMS = [
  '가디언 엔젤 링',
  '트와일라이트 마크',
  '에스텔라 이어링스',
  '데이브레이크 펜던트',
];

const SET_SLOTS: Record<string, Set<string>> = {
  루타비스: new Set(['무기', '모자', '상의', '하의']),
  아케인셰이드: new Set([
    '무기',
    '모자',
    '상의',
    '하의',
    '한벌옷',
    '신발',
    '장갑',
    '망토',
    '어깨장식',
  ]),
  앱솔랩스: new Set([
    '무기',
    '모자',
    '상의',
    '하의',
    '한벌옷',
    '신발',
    '장갑',
    '망토',
    '어깨장식',
  ]),
  에테르넬: new Set([
    '무기',
    '모자',
    '상의',
    '하의',
    '한벌옷',
    '신발',
    '장갑',
    '망토',
    '어깨장식',
  ]),
  '보스 장신구': new Set([
    '얼굴장식',
    '눈장식',
    '귀고리',
    '벨트',
    '펜던트',
    '반지',
    '포켓 아이템',
    '뱃지',
    '어깨장식',
  ]),
  '칠흑의 보스': new Set([
    '얼굴장식',
    '눈장식',
    '기계 심장',
    '벨트',
    '펜던트',
    '뱃지',
    '귀고리',
    '반지',
    '포켓 아이템',
    '엠블렘',
  ]),
  '여명의 보스': new Set(['반지', '얼굴장식', '귀고리', '펜던트']),
  '광휘의 보스': new Set(['반지', '펜던트', '훈장', '얼굴장식', '눈장식']),
};

const LUCKY_ITEMS: Array<{ match: RegExp; priority: number; slot: string }> = [
  { match: /카오스 벨룸의 헬름/, priority: 1, slot: '모자' },
  { match: /^스칼렛 이어링/, priority: 2, slot: '귀고리' },
  { match: /^(제네시스|데스티니) /, priority: 3, slot: '무기' },
  { match: /^스칼렛 링/, priority: 4, slot: '반지' },
  { match: /^스칼렛 숄더/, priority: 5, slot: '어깨장식' },
  { match: /^스칼렛 /, priority: 3, slot: '무기' },
];

export function normalizeSetName(name: string): string {
  return name.replace(/\s*세트\s*(\([^)]*\))?\s*$/, '').trim();
}

export function setOfItem(itemName: string): string | null {
  if (!itemName) return null;

  if (
    itemName.includes('여명') &&
    DAWN_ITEMS.some((dawnItem) => itemName.includes(dawnItem))
  ) {
    return '여명의 보스';
  }

  for (const [member, set] of ACCESSORY_MEMBERS) {
    if (itemName.includes(member)) return set;
  }
  for (const [pattern, set] of ACCESSORY_PATTERNS) {
    if (pattern.test(itemName)) return set;
  }
  for (const [pattern, set] of SET_ALIASES) {
    if (pattern.test(itemName)) return set;
  }

  return INFERABLE_SETS.find((set) => itemName.includes(set)) ?? null;
}

function luckyItem(names: string[]): { slot: string; priority: number } | null {
  let best: { slot: string; priority: number } | null = null;
  for (const name of names) {
    for (const lucky of LUCKY_ITEMS) {
      if (lucky.match.test(name) && (!best || lucky.priority < best.priority)) {
        best = { slot: lucky.slot, priority: lucky.priority };
      }
    }
  }
  return best;
}

export function countEquipmentSets(
  itemNames: string[]
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const itemName of itemNames) {
    const set = setOfItem(itemName);
    if (set) counts[set] = (counts[set] ?? 0) + 1;
  }

  const lucky = luckyItem(itemNames);
  if (lucky) {
    for (const [set, count] of Object.entries(counts)) {
      if (count >= 3 && SET_SLOTS[set]?.has(lucky.slot)) {
        counts[set] = count + 1;
      }
    }
  }

  return counts;
}

function addTier(block: StatBlock, tier: SetTier): void {
  const add = (key: keyof StatBlock, value: number | undefined) => {
    if (!value) return;
    const target = block as Record<string, number | number[] | undefined>;
    target[key] = ((target[key] as number | undefined) ?? 0) + value;
  };

  add('올스탯', tier.allStat);
  add('공격력', tier.atk);
  add('마력', tier.atk);
  add('보공', tier.boss);
  add('크뎀', tier.critDmg);
  add('HP', tier.hp);
  if (tier.ida) block.방무 = [...(block.방무 ?? []), tier.ida];
}

export function calculateSetEffects(
  counts: Record<string, number>
): Record<string, StatBlock> {
  const effects: Record<string, StatBlock> = {};

  for (const [set, count] of Object.entries(counts)) {
    const tiers = SET_DB[set];
    if (!tiers) continue;

    const block: StatBlock = {};
    for (const [requiredCount, tier] of Object.entries(tiers)) {
      if (Number(requiredCount) <= count) addTier(block, tier);
    }
    if (Object.keys(block).length > 0) effects[set] = block;
  }

  return effects;
}
