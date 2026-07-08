// 세트 효과 델타. 장비 교체로 세트 피스 수가 바뀌면 세트 보너스도 변하므로 Δ환산에 반영한다.
// SET_DB는 넥슨 오픈 API set-effect 수확본(단계별 증분 옵션). 증분 구조라 ±1피스 변화 = 해당 단계 옵션 1줄.
//
// 한계: 아이템명에 세트명이 있는 방어구/무기 세트만 현재 장비의 소속을 추론한다.
// 장신구 세트(보스 장신구·칠흑 등)는 아이템명에 세트명이 없어 현재 소속 추론 불가 → 제외(과대계상 방지).

import { SET_DB } from './set-db.js';
import { contributionFromOptionText, mergeContribution, negateContribution, EMPTY_CONTRIBUTION, type Contribution } from './calc.js';

// "앱솔랩스 세트(도적)" → "앱솔랩스", "보스 장신구 세트" → "보스 장신구"
function baseOf(setName: string): string {
  return setName.replace(/\s*세트.*$/, '').trim();
}

// 이름 추론 대상 base (아이템명이 base를 포함). 장신구 세트는 제외.
const NON_INFERABLE = new Set(['보스 장신구', '칠흑의 보스', '결속의 반지', '마스터 수호령', '이피아의 보물']);
const INFERABLE_BASES = Array.from(new Set(Object.keys(SET_DB).map(baseOf)))
  .filter((b) => b && !NON_INFERABLE.has(b))
  .sort((a, b) => b.length - a.length); // 긴 것 우선

// 아이템 이름 → 세트 base. 못 찾으면 null.
export function setBaseOfItem(itemName: string): string | null {
  if (!itemName) return null;
  return INFERABLE_BASES.find((b) => itemName.includes(b)) ?? null;
}

// base + 직업 변형 접미사로 SET_DB의 풀 세트명을 찾는다.
export function resolveFullSet(base: string, variantSuffix: string): string | null {
  for (const cand of [`${base} 세트${variantSuffix}`, `${base} 세트`]) {
    if (SET_DB[cand]) return cand;
  }
  return null;
}

// setCounts 키들에서 직업 변형 접미사("(도적)" 등)를 추정. 없으면 ''.
export function detectVariantSuffix(setCounts: Record<string, number>): string {
  const freq: Record<string, number> = {};
  for (const name of Object.keys(setCounts)) {
    const m = name.match(/(\([^)]+\))$/);
    if (m) freq[m[1]] = (freq[m[1]] ?? 0) + 1;
  }
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}

// 현재 장비의 oldSet 한 피스가 빠지고 candidate의 newSet 한 피스가 들어올 때 세트 보너스 순변화.
// oldSet/newSet은 SET_DB의 풀 세트명(또는 null). 같은 세트면 변화 없음.
export function setSwapDelta(
  setCounts: Record<string, number>,
  oldSet: string | null,
  newSet: string | null
): Contribution {
  let delta = EMPTY_CONTRIBUTION;
  if (newSet && newSet !== oldSet) {
    const opt = SET_DB[newSet]?.[(setCounts[newSet] ?? 0) + 1]; // 한 단계 올라가며 얻는 증분
    if (opt) delta = mergeContribution(delta, contributionFromOptionText(opt));
  }
  if (oldSet && oldSet !== newSet) {
    const opt = SET_DB[oldSet]?.[setCounts[oldSet] ?? 0]; // 현재 최상 단계에서 한 피스 빠지며 잃는 증분
    if (opt) delta = mergeContribution(delta, negateContribution(contributionFromOptionText(opt)));
  }
  return delta;
}
