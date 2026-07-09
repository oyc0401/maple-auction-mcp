// maplescouter 비공개 API 클라이언트 — hwansan2의 유일한 IO.
// api-key는 사이트 클라이언트(브라우저 번들)가 쓰는 공개 정적 키. 실측: docs/superpowers/specs/2026-07-09-hwansan2-design.md
const BASE = 'https://api.maplescouter.com';
const API_KEY = 'ff6a7ce0-c4ce-11ee-900c-df03c8ea0d4c';
const HEADERS = {
  'Content-Type': 'application/json',
  'api-key': API_KEY,
  Origin: 'https://maplescouter.com',
  Referer: 'https://maplescouter.com/',
};

export interface ScouterEquip {
  slot: string;
  name: string;
  totalOption: Record<string, string | number>;
  potential_option_1: (string | null)[];
  additional_potential_option_1: (string | null)[];
  soul_option: string | null;
  [k: string]: unknown;
}
export interface ScouterCalc { boss300_stat: number; boss380_stat: number; [k: string]: unknown }
export interface ScouterData {
  calculatedData: ScouterCalc;
  userStat: Record<string, unknown> & {
    stat: Record<string, string>;
    doping: unknown;
    linkSkill: unknown;
    special: Record<string, unknown>;
  };
  userEquipData: ScouterEquip[];
}

interface Opts { fetchFn?: typeof fetch; ttlMs?: number }

const idCache = new Map<string, { at: number; data: ScouterData }>();
export function clearScouterCache() { idCache.clear(); }

export async function fetchScouter(name: string, opts: Opts = {}): Promise<ScouterData> {
  const { fetchFn = fetch, ttlMs = 600_000 } = opts;
  const hit = idCache.get(name);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data;
  const url = `${BASE}/api/id?name=${encodeURIComponent(name)}&preset=00000&region=kms`;
  const res = await fetchFn(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`scouter /api/id ${res.status}`);
  const data = (await res.json()) as ScouterData;
  idCache.set(name, { at: Date.now(), data });
  return data;
}

// 전 축 0 델타 시뮬 블록. 실측: 이 블록으로 POST 시 boss380_stat == /api/id 값(30371 재현 확인).
// 도핑/링크는 userStat의 것을 그대로 복사(변경 없음 의미), weaponAtk는 절대값이라 현재값 유지.
export function baseSimulator(userStat: ScouterData['userStat']): Record<string, unknown> {
  const st = userStat.stat;
  const sp = userStat.special as Record<string, string>;
  return {
    mainStat: '0', mainStatPer: '0', mainStatAbs: '0',
    subStat: '0', subStatPer: '0', subStatAbs: '0',
    ssubStat: '0', ssubStatPer: '0', ssubStatAbs: '0',
    allStatPer: '0', criRate: '0', buffDuration: '0', coolTimeReduce: '0',
    atk: '0', atkPer: '0', bossDmg: '0', criDmg: '0', ignoreGuard: '0',
    genesis: false, mainStat9Level: '', subStat9Level: '', ssubStat9Level: '',
    finalDmg: '0.00000', resetCoolDown: '0.0', tms_fd: '',
    weaponAtk: st.weaponAtk,
    masteryCore1: '', masteryCore2: '', masteryCore3: '', masteryCore4: '',
    skillCore1: '', skillCore2: '', reinCore1: '', reinCore2: '', reinCore3: '', reinCore4: '',
    generalCore2: '', generalCore3: '', erda: '0', solJanus: '0',
    dopingSimul: userStat.doping,
    linkSimul: userStat.linkSkill,
    restraintRing: sp.restraintRing ?? '0', weaponRing: sp.weaponRing ?? '0',
    ringofSum: sp.ringOfSum ?? '0', riskTaker: sp.riskTaker ?? '0',
    contiRing: sp.continuosRing ?? '0', destiny2ndSkill: sp.destiny2ndSkill ?? false,
  };
}

export async function simulate(
  userStat: ScouterData['userStat'],
  sim: Record<string, unknown>,
  opts: Opts = {}
): Promise<ScouterCalc> {
  const { fetchFn = fetch } = opts;
  const res = await fetchFn(`${BASE}/api/calc/dmg-simulator`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ userStat, simulator: sim }),
  });
  if (!res.ok) throw new Error(`scouter dmg-simulator ${res.status}`);
  return (await res.json()) as ScouterCalc;
}
