// 넥슨 오픈 API 클라이언트 (환산 계산용 캐릭터 스탯 조회).
// 경매장 API와 달리 공개 API + 개발자 키 인증이라 브릿지(크롬 확장)를 거치지 않고 서버가 직접 호출한다.
// 키가 없으면 환산 기능만 비활성(우아한 degrade)되고 검색은 정상 동작.
//
// 데이터: character/stat(최종 종합 스탯) + character/item-equipment(현재 무기 = Δ환산 비교 기준).
// 캐릭명 기준으로 프로세스 생존 동안 인메모리 캐시(오픈 API는 일 1회 갱신, 재시작 시 초기화).

import { contributionFromEquip, type Contribution } from './calc.js';
import { resolveStatModel, type MainStat } from './jobs.js';

const OPEN_BASE = 'https://open.api.nexon.com/maplestory/v1';

export interface CharacterSpec {
  characterName: string;
  characterClass: string;
  mainStat: MainStat;
  isMagic: boolean; // INT 주력 → 마력 기준
  main: number; // 주스탯 (최종)
  sub: number; // 부스탯 (최종)
  attack: number; // 총공격력 또는 총마력
  damageBossSum: number; // 데미지% + 보스몬스터데미지%
  ignoreDef: number; // 방어율 무시(실방무) %
  critRate: number;
  critDamage: number;
  finalDamage: number;
  currentWeapon: Contribution | null; // 현재 착용 무기 기여도 (Δ환산 기준)
}

export function nexonApiKey(): string | undefined {
  return process.env.NEXON_DEVELOPER_KEY || process.env.NEXON_DELEVOPER_KEY;
}

function statMap(finalStat: { stat_name: string; stat_value: string }[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const s of finalStat ?? []) m[s.stat_name] = Number(s.stat_value);
  return m;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 429(rate limit)는 지수 백오프로 재시도. 그 외 오류는 즉시 throw.
async function fetchJson(path: string, params: Record<string, string>, key: string): Promise<any> {
  const url = new URL(`${OPEN_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'x-nxopen-api-key': key } });
    if (res.ok) return res.json();
    if (res.status === 429 && attempt < 4) {
      await sleep(300 * 2 ** attempt);
      continue;
    }
    let detail = '';
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      /* ignore */
    }
    throw new Error(`넥슨 오픈 API 오류 (${res.status}) ${path} ${detail}`);
  }
}

// 캐릭명 → 스펙. 서버 프로세스 생존 동안 유지(넥슨 오픈 API 재호출 최소화).
const cache = new Map<string, CharacterSpec>();

// 캐릭터 스펙을 조회한다. 키 없음/조회 실패/미지원 직업이면 에러 문자열 반환(호출부에서 환산 생략).
export async function fetchCharacterSpec(characterName: string): Promise<CharacterSpec | string> {
  const key = nexonApiKey();
  if (!key) return 'NEXON_DEVELOPER_KEY 미설정 — 환산 계산을 건너뜁니다.';

  const hit = cache.get(characterName);
  if (hit) return hit;

  try {
    const { ocid } = await fetchJson('/id', { character_name: characterName }, key);
    if (!ocid) return `캐릭터를 찾지 못했습니다: ${characterName}`;

    const [statRes, equipRes] = await Promise.all([
      fetchJson('/character/stat', { ocid }, key),
      fetchJson('/character/item-equipment', { ocid }, key),
    ]);

    const m = statMap(statRes.final_stat);
    const model = resolveStatModel(statRes.character_class ?? '', m);
    if (model.kind !== 'standard') return `${statRes.character_class}: 환산 미지원 (${model.reason})`;

    const isMagic = model.main === 'INT';
    const equip = (equipRes.item_equipment ?? []) as any[];
    const weapon = equip.find((it) => it.item_equipment_slot === '무기');

    const spec: CharacterSpec = {
      characterName,
      characterClass: statRes.character_class ?? '',
      mainStat: model.main,
      isMagic,
      main: m[model.main] ?? 0,
      sub: m[model.sub] ?? 0,
      attack: isMagic ? (m['마력'] ?? 0) : (m['공격력'] ?? 0),
      damageBossSum: (m['데미지'] ?? 0) + (m['보스 몬스터 데미지'] ?? 0),
      ignoreDef: m['방어율 무시'] ?? 0,
      critRate: m['크리티컬 확률'] ?? 0,
      critDamage: m['크리티컬 데미지'] ?? 0,
      finalDamage: m['최종 데미지'] ?? 0,
      currentWeapon: weapon ? contributionFromEquip(weapon, model.main, isMagic) : null,
    };
    cache.set(characterName, spec);
    return spec;
  } catch (e) {
    return `넥슨 오픈 API 조회 실패: ${(e as Error).message}`;
  }
}
