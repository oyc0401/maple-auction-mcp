// 세트 효과 델타. 장비 교체로 세트 피스 수가 바뀌면 세트 보너스도 변하므로 Δ환산에 반영한다.
// SET_DB는 단계별 증분 옵션(base 세트명 키). 증분 구조라 count 변화 = 해당 단계 옵션의 누적 차.
//
// 세트명은 base로 정규화한다("앱솔랩스 세트(도적)" → "앱솔랩스"). 세트효과 수치가 전 직업군 동일이라
// 직업 변형을 구분할 필요가 없다. 한계: 아이템명에 세트명이 있는 방어구/무기 세트만 현재 소속을 추론한다.
// 장신구 세트(보스 장신구·칠흑·여명)는 아이템명에 세트명이 없어 소속 추론 불가 → 런타임 제외(과대계상 방지).

import { SET_DB, type SetTier } from './set-db.js';
import { mergeContribution, negateContribution, EMPTY_CONTRIBUTION, type Contribution } from './calc.js';

// 세트 단계 옵션(SetTier) → Contribution. 세트는 공격력=마력 동일이라 둘 다 채우고,
// 계산에서 주력에 맞는 쪽(공격력/마력)만 쓴다. 방무는 곱연산 계수로 보관.
function tierContribution(t: SetTier): Contribution {
  return {
    ...EMPTY_CONTRIBUTION,
    atk: t.atk ?? 0,
    matk: t.atk ?? 0,
    allStat: t.allStat ?? 0,
    dmgBoss: t.boss ?? 0,
    idaFactor: t.ida ? 1 - t.ida / 100 : 1,
    critDmg: t.critDmg ?? 0,
  };
}

// "앱솔랩스 세트(도적)" → "앱솔랩스", "칠흑의 보스 세트" → "칠흑의 보스"
export function normalizeSet(setName: string | null | undefined): string | null {
  if (!setName) return null;
  return setName.replace(/\s*세트\s*(\([^)]*\))?\s*$/, '').trim() || null;
}

// 아이템명으로 소속 추론이 가능한 세트 base (장신구 세트는 제외).
const NON_INFERABLE = new Set(['여명의 보스', '칠흑의 보스', '보스 장신구']);
const INFERABLE_BASES = Object.keys(SET_DB)
  .filter((b) => !NON_INFERABLE.has(b))
  .sort((a, b) => b.length - a.length); // 긴 것 우선

// 아이템 이름 → 세트 base. 못 찾으면 null.
export function setBaseOfItem(itemName: string): string | null {
  if (!itemName) return null;
  return INFERABLE_BASES.find((b) => itemName.includes(b)) ?? null;
}

// 세트 count단계에서 활성인 누적 보너스 (2..count 중 DB에 있는 단계 증분의 합). set은 base명.
export function setBonusAt(set: string, count: number): Contribution {
  const tiers = SET_DB[set];
  if (!tiers) return EMPTY_CONTRIBUTION;
  let c = EMPTY_CONTRIBUTION;
  for (const [tierStr, opt] of Object.entries(tiers)) {
    if (Number(tierStr) <= count) c = mergeContribution(c, tierContribution(opt));
  }
  return c;
}

// 현재 장비 oldSet 한 피스가 빠지고 candidate newSet 한 피스가 들어올 때 세트 보너스 순변화. set은 base명.
export function setSwapDelta(
  setCounts: Record<string, number>,
  oldSet: string | null,
  newSet: string | null
): Contribution {
  if (!oldSet && !newSet) return EMPTY_CONTRIBUTION;
  return comboSetDelta(setCounts, [{ oldSet, newSet }]);
}

// 여러 부위 동시 교체(조합)로 인한 세트 카운트 변화 → 총 세트 보너스 델타(다단계 반영). set은 base명.
export function comboSetDelta(
  baseCounts: Record<string, number>,
  changes: { oldSet: string | null; newSet: string | null }[]
): Contribution {
  const counts: Record<string, number> = { ...baseCounts };
  const affected = new Set<string>();
  for (const { oldSet, newSet } of changes) {
    if (oldSet) { counts[oldSet] = (counts[oldSet] ?? 0) - 1; affected.add(oldSet); }
    if (newSet) { counts[newSet] = (counts[newSet] ?? 0) + 1; affected.add(newSet); }
  }
  let delta = EMPTY_CONTRIBUTION;
  for (const set of affected) {
    delta = mergeContribution(delta, setBonusAt(set, counts[set] ?? 0));
    delta = mergeContribution(delta, negateContribution(setBonusAt(set, baseCounts[set] ?? 0)));
  }
  return delta;
}
