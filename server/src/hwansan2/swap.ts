// 교체 환산: 현재 장비(slot)를 경매장 매물로 바꿀 때의 Δ환산(380/300).
// 흐름: ItemStats(현재/새) + 세트 델타 → simulator 축 델타 → dmg-simulator POST → Δ.
import { baseSimulator, simulate, type ScouterData } from './scouterClient.js';
import { fromScouterEquip, fromAuctionRaw, statAxes, toSimulatorDelta } from './axes.js';
import { setSwapStatsByNames } from './sets.js';

let simCaches = new WeakMap<object, Map<string, { delta380: number; delta300: number; unknown: string[] }>>();
export function clearSwapCache() { simCaches = new WeakMap(); }
function cacheFor(data: object) {
  let m = simCaches.get(data);
  if (!m) { m = new Map(); simCaches.set(data, m); }
  return m;
}

export async function swapDelta380(
  data: ScouterData,
  slot: string,
  newItemRaw: any,
  opts: { fetchFn?: typeof fetch } = {}
): Promise<{ delta380: number; delta300: number; unknown: string[] } | null> {
  if (slot === '무기') return null; // weaponAtk 축 의미 미확정 — v1 제외
  const ax = statAxes(data.userStat);
  if (!ax) return null; // 제논·데벤져 미지원
  const cur = data.userEquipData.find((e) => e.slot === slot);
  if (!cur) return null;

  const key = `${slot}:${newItemRaw?._id ?? JSON.stringify(newItemRaw?.toolTip?.stat ?? {})}`;
  const simCache = cacheFor(data);
  const hit = simCache.get(key);
  if (hit) return hit;

  const curStats = fromScouterEquip(cur);
  const nextStats = fromAuctionRaw(newItemRaw);
  // 럭키템(3피스 이상 세트 전체 +1) 재판정을 위해 교체 전/후 이름 목록을 각각 countSets로 돌린다.
  // 동일 이름 장비가 여럿(반지 등)일 수 있어 findIndex로 이 slot의 아이템 하나만 교체.
  const names = data.userEquipData.map((e) => e.name);
  const idx = data.userEquipData.findIndex((e) => e.slot === slot);
  const namesAfter = [...names];
  namesAfter[idx] = String(newItemRaw?.itemName ?? '');
  const setDelta = setSwapStatsByNames(names, namesAfter);
  const unknown = [...new Set([...curStats.unknown, ...nextStats.unknown])];

  const baseIgn = Number(data.userStat.stat.ignoreDef ?? 0);
  const axDelta = toSimulatorDelta(curStats, nextStats, setDelta, ax, baseIgn);
  if (!axDelta) {
    const zero = { delta380: 0, delta300: 0, unknown };
    simCache.set(key, zero);
    return zero;
  }

  const sim = { ...baseSimulator(data.userStat), ...axDelta };
  const calc = await simulate(data.userStat, sim, opts);
  const result = {
    delta380: Math.round(calc.boss380_stat - data.calculatedData.boss380_stat),
    delta300: Math.round(calc.boss300_stat - data.calculatedData.boss300_stat),
    unknown,
  };
  simCache.set(key, result);
  return result;
}
