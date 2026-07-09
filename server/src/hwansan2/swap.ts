// 교체 환산: 현재 장비(slot)를 경매장 매물로 바꿀 때의 Δ환산(380/300).
// 흐름: ItemStats(현재/새) + 세트 델타 → simulator 축 델타 → dmg-simulator POST → Δ.
import { baseSimulator, simulate, type ScouterData } from './scouterClient.js';
import { fromScouterEquip, fromAuctionRaw, statAxes, toSimulatorDelta } from './axes.js';
import { setSwapStatsByNames, countSets, parseSetOption, normalizeSet, KNOWN_SETS } from './sets.js';

let simCaches = new WeakMap<object, Map<string, { delta380: number; delta300: number; unknown: string[] }>>();
export function clearSwapCache() { simCaches = new WeakMap(); }
function cacheFor(data: object) {
  let m = simCaches.get(data);
  if (!m) { m = new Map(); simCaches.set(data, m); }
  return m;
}

// 스카우터가 계산한 현재 세트 카운트 원문 (userApiData.info.set_option — 장신구 세트·여명 전환 포함)
function apiSetCounts(data: ScouterData): Record<string, number> {
  const raw = (data as any).userApiData?.info?.set_option;
  return parseSetOption(typeof raw === 'string' ? raw : null);
}

export async function swapDelta380(
  data: ScouterData,
  slot: string,
  newItemRaw: any,
  opts: { fetchFn?: typeof fetch } = {}
): Promise<{ delta380: number; delta300: number; unknown: string[] } | null> {
  if (slot === '무기') return null; // weaponAtk 축 의미 미확정 — v1 제외
  const ax = statAxes(data.userStat);
  const cur = data.userEquipData.find((e) => e.slot === slot);
  if (!cur) return null;

  const key = `${slot}:${newItemRaw?._id ?? JSON.stringify(newItemRaw?.toolTip?.stat ?? {})}`;
  const simCache = cacheFor(data);
  const hit = simCache.get(key);
  if (hit) return hit;

  const curStats = fromScouterEquip(cur);
  const nextStats = fromAuctionRaw(newItemRaw);
  const unknown = new Set([...curStats.unknown, ...nextStats.unknown]);

  // 세트 델타: 럭키템(3피스 이상 세트 전체 +1) 재판정을 위해 교체 전/후 이름 목록을 각각 countSets로.
  // 동일 이름 장비가 여럿(반지 등)일 수 있어 findIndex로 이 slot의 아이템 하나만 교체.
  const names = data.userEquipData.map((e) => e.name);
  const idx = data.userEquipData.findIndex((e) => e.slot === slot);
  const namesAfter = [...names];
  const newName = String(newItemRaw?.itemName ?? '');
  namesAfter[idx] = newName;
  // 매물의 세트 소속은 경매장 toolTip.setEffects(공식 세트명)를 우선 사용, 여명 전환 수는 API set_option에서.
  const apiCounts = apiSetCounts(data);
  const setOpts = {
    aliases: {} as Record<string, string>,
    dawnCount: apiCounts['여명의 보스'] ?? 0,
  };
  const officialNewSet = normalizeSet(newItemRaw?.toolTip?.setEffects?.[0]);
  if (officialNewSet) setOpts.aliases[newName] = officialNewSet;
  const setDelta = setSwapStatsByNames(names, namesAfter, setOpts);

  // 교차검증: 우리 카운트가 스카우터 계산(set_option)과 다르면 신호로 노출 (멤버십 누락·신규 세트 탐지)
  const ourCounts = countSets(names, setOpts);
  for (const [set, apiCount] of Object.entries(apiCounts)) {
    if (!KNOWN_SETS.has(set)) continue; // 델타 계산에 안 쓰는 세트(마이스터·파퀘 등)는 대조 생략
    if ((ourCounts[set] ?? 0) !== apiCount) unknown.add(`세트카운트 불일치(${set}: 계산 ${ourCounts[set] ?? 0} vs 스카우터 ${apiCount})`);
  }

  const baseIgn = Number(data.userStat.stat.ignoreDef ?? 0);
  const axDelta = toSimulatorDelta(curStats, nextStats, setDelta, ax, baseIgn);
  if (!axDelta) {
    const zero = { delta380: 0, delta300: 0, unknown: [...unknown] };
    simCache.set(key, zero);
    return zero;
  }

  const sim = { ...baseSimulator(data.userStat), ...axDelta };
  const calc = await simulate(data.userStat, sim, opts);
  const result = {
    delta380: Math.round(calc.boss380_stat - data.calculatedData.boss380_stat),
    delta300: Math.round(calc.boss300_stat - data.calculatedData.boss300_stat),
    unknown: [...unknown],
  };
  simCache.set(key, result);
  return result;
}
