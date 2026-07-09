// 세트 카운팅(장비명 추론 + 럭키 아이템) + 교체 세트 델타.
// 옛 hwansan/sets.ts에서 이관, Contribution 대신 ItemStats 사용. 장신구 세트(칠흑·여명 등)는
// 아이템명으로 소속 추론이 안 되므로 카운팅 제외(교체 델타도 미반영 — 과대계상 방지, MCP 안내문에 명시).
import { SET_DB, type SetTier } from './tables/setDb.js';
import { emptyItemStats, type ItemStats } from './axes.js';

export function normalizeSet(setName: string | null | undefined): string | null {
  if (!setName) return null;
  return setName.replace(/\s*세트\s*(\([^)]*\))?\s*$/, '').trim() || null;
}

const NON_INFERABLE = new Set(['여명의 보스', '칠흑의 보스', '보스 장신구', '광휘의 보스', '마스터 카오스']);
const INFERABLE_BASES = Object.keys(SET_DB)
  .filter((b) => !NON_INFERABLE.has(b))
  .sort((a, b) => b.length - a.length);

export function setBaseOfItem(itemName: string): string | null {
  if (!itemName) return null;
  return INFERABLE_BASES.find((b) => itemName.includes(b)) ?? null;
}

// 럭키 아이템 우선순위(넥슨 오피셜): 카벨모자 > 스칼렛 이어링 > 스칼렛 무기 = 제네시스 무기 > 스칼렛 링 > 스칼렛 견장.
// 데스티니 무기 포함. 제네시스 무기는 해방 시에만 럭키 — 해방 여부를 API가 안 주므로 럭키로 간주(한계 주석).
export const LUCKY_ITEMS: { match: RegExp; priority: number }[] = [
  { match: /카오스 벨룸의 헬름/, priority: 1 },
  { match: /^스칼렛 이어링/, priority: 2 },
  { match: /^(제네시스|데스티니) /, priority: 3 },
  { match: /^스칼렛 링/, priority: 4 },
  { match: /^스칼렛 숄더/, priority: 5 },
  { match: /^스칼렛 /, priority: 3 }, // 스칼렛 무기(그 외 스칼렛) = 제네시스 무기와 동률. 링/숄더/이어링은 위 개별 항목이 먼저 매칭됨
];

function luckyOf(names: string[]): string | null {
  let best: { name: string; priority: number } | null = null;
  for (const n of names) {
    for (const L of LUCKY_ITEMS) {
      if (L.match.test(n) && (!best || L.priority < best.priority)) best = { name: n, priority: L.priority };
    }
  }
  return best?.name ?? null;
}

// 장비명 목록 → 세트base별 피스 수. 럭키템 1개가 3피스 이상인 모든 세트에 +1.
export function countSets(equipNames: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const n of equipNames) {
    const base = setBaseOfItem(n);
    if (base) counts[base] = (counts[base] ?? 0) + 1;
  }
  if (luckyOf(equipNames)) {
    for (const [base, c] of Object.entries(counts)) if (c >= 3) counts[base] = c + 1;
  }
  return counts;
}

function tierStats(t: SetTier): ItemStats {
  const s = emptyItemStats();
  s.atk = t.atk ?? 0; s.matk = t.atk ?? 0; // 세트는 공=마 동일
  const all = t.allStat ?? 0;
  (['STR', 'DEX', 'INT', 'LUK'] as const).forEach((k) => (s.flat[k] += all));
  s.dmgBoss = t.boss ?? 0;
  s.iedFactor = t.ida ? 1 - t.ida / 100 : 1;
  s.critDmg = t.critDmg ?? 0;
  return s;
}

function mergeStats(a: ItemStats, b: ItemStats, sign: 1 | -1): ItemStats {
  const out = structuredClone(a);
  (['STR', 'DEX', 'INT', 'LUK'] as const).forEach((k) => { out.flat[k] += sign * b.flat[k]; out.pct[k] += sign * b.pct[k]; });
  out.hp += sign * b.hp; out.atk += sign * b.atk; out.matk += sign * b.matk;
  out.allPct += sign * b.allPct; out.atkPct += sign * b.atkPct; out.matkPct += sign * b.matkPct;
  out.dmgBoss += sign * b.dmgBoss; out.critDmg += sign * b.critDmg; out.finalDmg += sign * b.finalDmg;
  out.coolSec += sign * b.coolSec;
  out.iedFactor = sign === 1 ? out.iedFactor * b.iedFactor : out.iedFactor / (b.iedFactor || 1);
  return out;
}

function bonusAt(set: string, count: number): ItemStats {
  const tiers = SET_DB[set];
  let acc = emptyItemStats();
  if (!tiers) return acc;
  for (const [tierStr, opt] of Object.entries(tiers)) {
    if (Number(tierStr) <= count) acc = mergeStats(acc, tierStats(opt), 1);
  }
  return acc;
}

// 한 부위 교체(oldSet 1피스 out, newSet 1피스 in)의 세트 보너스 순변화.
export function setSwapStats(
  counts: Record<string, number>,
  oldSet: string | null,
  newSet: string | null
): ItemStats {
  if (!oldSet && !newSet) return emptyItemStats();
  const after: Record<string, number> = { ...counts };
  if (oldSet) after[oldSet] = (after[oldSet] ?? 0) - 1;
  if (newSet) after[newSet] = (after[newSet] ?? 0) + 1;
  let delta = emptyItemStats();
  for (const set of new Set([oldSet, newSet].filter(Boolean) as string[])) {
    delta = mergeStats(delta, bonusAt(set, after[set] ?? 0), 1);
    delta = mergeStats(delta, bonusAt(set, counts[set] ?? 0), -1);
  }
  return delta;
}
