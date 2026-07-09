// 세트 카운팅(장비명 추론 + 럭키 아이템) + 교체 세트 델타.
// 옛 hwansan/sets.ts에서 이관, Contribution 대신 ItemStats 사용. 장신구 세트(칠흑·여명 등)는
// 아이템명으로 소속 추론이 안 되므로 카운팅 제외(교체 델타도 미반영 — 과대계상 방지, MCP 안내문에 명시).
import { SET_DB, type SetTier } from './tables/setDb.js';
import { emptyItemStats, type ItemStats } from './axes.js';

export function normalizeSet(setName: string | null | undefined): string | null {
  if (!setName) return null;
  return setName.replace(/\s*세트\s*(\([^)]*\))?\s*$/, '').trim() || null;
}

export const KNOWN_SETS = new Set(Object.keys(SET_DB)); // 델타 계산 가능한 세트(교차검증도 이 범위만)
const NON_INFERABLE = new Set(['여명의 보스', '칠흑의 보스', '보스 장신구', '광휘의 보스', '마스터 카오스']);
const INFERABLE_BASES = Object.keys(SET_DB)
  .filter((b) => !NON_INFERABLE.has(b))
  .sort((a, b) => b.length - a.length);

// 아이템명 접두 → 세트 base 별칭 (이름에 세트명이 없는 세트)
const SET_ALIASES: [RegExp, string][] = [
  [/^(하이네스|이글아이|트릭스터|파프니르) /, '루타비스'],
];

// 장신구 세트 멤버십 (이름에 세트명이 없어 개별 명시). 보스 장신구 목록은 검증 캐릭터 실측
// (스카우터 set_option "보스 장신구 세트 : 9"와 착용 9종 교차 확인) + 통용 구성. 여명 4종은
// 미전환 시 보스 장신구 소속(실측: 가디언 엔젤 링이 보장 9피스에 포함) — 전환분은 dawnCount로 처리.
const ACCESSORY_MEMBERS = new Map<string, string>([
  // 보스 장신구
  ['응축된 힘의 결정석', '보스 장신구'], ['블랙빈 마크', '보스 장신구'], ['아쿠아틱 레터 눈장식', '보스 장신구'],
  ['파풀라투스 마크', '보스 장신구'], ['데아 시두스 이어링', '보스 장신구'], ['골든 클로버 벨트', '보스 장신구'],
  ['매커네이터 펜던트', '보스 장신구'], ['도미네이터 펜던트', '보스 장신구'], ['핑크빛 성배', '보스 장신구'],
  ['크리스탈 웬투스 뱃지', '보스 장신구'], ['로얄 블랙메탈 숄더', '보스 장신구'], ['고귀한 이피아의 반지', '보스 장신구'],
  // 여명(미전환 시 보스 장신구로 카운트)
  ['가디언 엔젤 링', '보스 장신구'], ['트와일라이트 마크', '보스 장신구'],
  ['에스텔라 이어링스', '보스 장신구'], ['데이브레이크 펜던트', '보스 장신구'],
  // 칠흑
  ['루즈 컨트롤 마시너리', '칠흑의 보스'], ['마력이 깃든 안대', '칠흑의 보스'], ['블랙 하트', '칠흑의 보스'],
  ['몽환의 벨트', '칠흑의 보스'], ['고통의 근원', '칠흑의 보스'], ['창세의 뱃지', '칠흑의 보스'],
  ['커맨더 포스 이어링', '칠흑의 보스'], ['거대한 공포', '칠흑의 보스'], ['저주받은 적의 마도서', '칠흑의 보스'],
  ['컴플리트 언더컨트롤', '칠흑의 보스'], ['그리드 펜던트', '칠흑의 보스'], // 그리드 펜던트: 아델 실측 소거법 확정
  // 광휘의 보스 (인게임 실측 제공: 반지2·펜던트·훈장·얼장·눈장 6종. 아델 실측 소거법과 교차 일치)
  ['근원의 속삭임', '광휘의 보스'], ['죽음의 맹세', '광휘의 보스'], ['불멸의 유산', '광휘의 보스'],
  ['황홀한 악몽', '광휘의 보스'], ['오만의 원죄', '광휘의 보스'], ['굶주리는 핏빛 원혼', '광휘의 보스'],
]);

// 여명 전환 가능 아이템(주문서로 보스 장신구 → 여명 세트 전환)
const DAWN_CONVERTIBLE = new Set(['가디언 엔젤 링', '트와일라이트 마크', '에스텔라 이어링스', '데이브레이크 펜던트']);

export function setBaseOfItem(itemName: string): string | null {
  if (!itemName) return null;
  for (const [member, base] of ACCESSORY_MEMBERS) if (itemName.includes(member)) return base;
  for (const [re, base] of SET_ALIASES) if (re.test(itemName)) return base;
  return INFERABLE_BASES.find((b) => itemName.includes(b)) ?? null;
}

// 스카우터 userApiData.info.set_option("루타비스 세트(도적) : 2 | 보스 장신구 세트 : 9 | ") → base별 카운트
export function parseSetOption(setOption: string | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  if (!setOption) return out;
  for (const part of setOption.split('|')) {
    const m = part.trim().match(/^(.+?)\s*:\s*(\d+)$/);
    if (!m) continue;
    const base = normalizeSet(m[1]);
    if (base) out[base] = Number(m[2]);
  }
  return out;
}

// 럭키 아이템 우선순위(넥슨 오피셜): 카벨모자 > 스칼렛 이어링 > 스칼렛 무기 = 제네시스 무기 > 스칼렛 링 > 스칼렛 견장.
// 데스티니 무기 포함. 제네시스 무기는 해방 시에만 럭키 — 해방 여부를 API가 안 주므로 럭키로 간주(한계 주석).
// slot: 럭키 +1은 그 부위가 구성에 포함된 세트에만 적용 (실측: 아델 데스티니 무기 → 에테르넬 +1, 칠흑 +0).
export const LUCKY_ITEMS: { match: RegExp; priority: number; slot: string }[] = [
  { match: /카오스 벨룸의 헬름/, priority: 1, slot: '모자' },
  { match: /^스칼렛 이어링/, priority: 2, slot: '귀고리' },
  { match: /^(제네시스|데스티니) /, priority: 3, slot: '무기' },
  { match: /^스칼렛 링/, priority: 4, slot: '반지' },
  { match: /^스칼렛 숄더/, priority: 5, slot: '어깨장식' },
  { match: /^스칼렛 /, priority: 3, slot: '무기' }, // 스칼렛 무기 = 제네시스 무기와 동률. 링/숄더/이어링은 위 개별 항목이 먼저 매칭됨
];

// 세트별 구성 부위 (럭키 적용 판정용). 방어구 세트는 실구성, 장신구 세트는 멤버 실측 기준.
const SET_SLOTS: Record<string, Set<string>> = {
  루타비스: new Set(['무기', '모자', '상의', '하의']),
  아케인셰이드: new Set(['무기', '모자', '상의', '하의', '한벌옷', '신발', '장갑', '망토', '어깨장식']),
  앱솔랩스: new Set(['무기', '모자', '상의', '하의', '한벌옷', '신발', '장갑', '망토', '어깨장식']),
  에테르넬: new Set(['무기', '모자', '상의', '하의', '한벌옷', '신발', '장갑', '망토', '어깨장식']),
  '보스 장신구': new Set(['얼굴장식', '눈장식', '귀고리', '벨트', '펜던트', '반지', '포켓 아이템', '뱃지', '어깨장식']),
  '칠흑의 보스': new Set(['반지', '눈장식', '기계 심장', '벨트', '펜던트', '귀고리', '포켓 아이템', '뱃지']),
  '여명의 보스': new Set(['반지', '얼굴장식', '귀고리', '펜던트']),
  '광휘의 보스': new Set(['반지', '펜던트', '훈장', '얼굴장식', '눈장식']),
};

function luckyOf(names: string[]): { name: string; slot: string } | null {
  let best: { name: string; slot: string; priority: number } | null = null;
  for (const n of names) {
    for (const L of LUCKY_ITEMS) {
      if (L.match.test(n) && (!best || L.priority < best.priority)) best = { name: n, slot: L.slot, priority: L.priority };
    }
  }
  return best ? { name: best.name, slot: best.slot } : null;
}

export interface SetCountOpts {
  aliases?: Record<string, string>; // 아이템명 → 세트 base 강제 지정 (경매장 매물의 toolTip.setEffects 공식 세트명)
  dawnCount?: number; //              여명 전환된 피스 수 (set_option의 '여명의 보스' 카운트) — 전환분은 보장 대신 여명으로
}

// 장비명 목록 → 세트base별 피스 수. 럭키템 1개가 3피스 이상인 모든 세트에 +1.
export function countSets(equipNames: string[], opts: SetCountOpts = {}): Record<string, number> {
  const counts: Record<string, number> = {};
  let dawnLeft = opts.dawnCount ?? 0;
  for (const n of equipNames) {
    let base = opts.aliases?.[n] ?? setBaseOfItem(n);
    if (base === '보스 장신구' && dawnLeft > 0 && DAWN_CONVERTIBLE.has(n)) { base = '여명의 보스'; dawnLeft--; }
    if (base) counts[base] = (counts[base] ?? 0) + 1;
  }
  const lucky = luckyOf(equipNames);
  if (lucky) {
    for (const [base, c] of Object.entries(counts)) {
      if (c >= 3 && (SET_SLOTS[base]?.has(lucky.slot) ?? true)) counts[base] = c + 1;
    }
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

// 교체 전/후 장비명 목록 각각으로 countSets를 돌려 세트 보너스 순변화를 구한다.
// 럭키템 자체의 교체(획득/상실)나 3피스 경계를 넘는 교체 모두 카운트 diff에 자연히 반영된다
// (기존 setSwapStats는 oldSet/newSet 1피스 증감만 가정해 럭키 재판정을 놓쳤다 — 삭제).
export function setSwapStatsByNames(namesBefore: string[], namesAfter: string[], opts: SetCountOpts = {}): ItemStats {
  const countsB = countSets(namesBefore, opts);
  const countsA = countSets(namesAfter, opts);
  const sets = new Set([...Object.keys(countsB), ...Object.keys(countsA)]);
  let delta = emptyItemStats();
  for (const set of sets) {
    delta = mergeStats(delta, bonusAt(set, countsA[set] ?? 0), 1);
    delta = mergeStats(delta, bonusAt(set, countsB[set] ?? 0), -1);
  }
  return delta;
}
