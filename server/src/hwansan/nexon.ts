// 넥슨 오픈 API 클라이언트 (환산 계산용 캐릭터 스탯 조회).
// 경매장 API와 달리 공개 API + 개발자 키 인증이라 브릿지(크롬 확장)를 거치지 않고 서버가 직접 호출한다.
// 키가 없으면 환산 기능만 비활성(우아한 degrade)되고 검색은 정상 동작.
//
// 데이터: character/basic(레벨) + character/stat(최종 종합 스탯) + character/item-equipment(현재 장비 = 비교 기준).
// 캐릭명 기준으로 프로세스 생존 동안 인메모리 캐시(오픈 API는 일 1회 갱신, 재시작 시 초기화).

import { contributionFromEquip, type CharState, type Contribution } from './calc.js';
import { resolveStatModel, isMagicModel, type StatModel } from './jobs.js';
import { setBaseOfItem, resolveFullSet, detectVariantSuffix } from './sets.js';

const OPEN_BASE = 'https://open.api.nexon.com/maplestory/v1';

// CharState(계산 입력) + 표시/파싱용 메타.
export interface CharacterSpec extends CharState {
  characterName: string;
  characterClass: string;
  isMagic: boolean;
  currentWeapon: Contribution | null; // 현재 착용 무기 (Δ환산 비교 기준)
  equipmentBySlot: Record<string, Contribution>; // 부위명 → 현재 장비 기여 (방어구/장신구 비교용)
  setCounts: Record<string, number>; // 세트명 → 현재 착용 피스 수
  slotSet: Record<string, string>; // 부위명 → 그 부위 장비의 세트명(이름 추론 가능한 방어구/무기만)
  model: StatModel;
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

// 캐릭터 스펙을 조회한다. 키 없음/조회 실패면 에러 문자열 반환(호출부에서 환산 생략).
export async function fetchCharacterSpec(characterName: string): Promise<CharacterSpec | string> {
  const key = nexonApiKey();
  if (!key) return 'NEXON_DEVELOPER_KEY 미설정 — 환산 계산을 건너뜁니다.';

  const hit = cache.get(characterName);
  if (hit) return hit;

  try {
    const { ocid } = await fetchJson('/id', { character_name: characterName }, key);
    if (!ocid) return `캐릭터를 찾지 못했습니다: ${characterName}`;

    const [basicRes, statRes, equipRes, setRes] = await Promise.all([
      fetchJson('/character/basic', { ocid }, key),
      fetchJson('/character/stat', { ocid }, key),
      fetchJson('/character/item-equipment', { ocid }, key),
      fetchJson('/character/set-effect', { ocid }, key),
    ]);

    const m = statMap(statRes.final_stat);
    const model = resolveStatModel(statRes.character_class ?? '', m);
    const isMagic = isMagicModel(model);

    const setCounts: Record<string, number> = {};
    for (const s of setRes.set_effect ?? []) setCounts[s.set_name] = Number(s.total_set_count ?? 0);
    const variantSuffix = detectVariantSuffix(setCounts);

    const equip = (equipRes.item_equipment ?? []) as any[];
    const bySlot: Record<string, Contribution> = {};
    const slotSet: Record<string, string> = {};
    for (const it of equip) {
      const slot = it.item_equipment_slot;
      if (!slot || bySlot[slot]) continue;
      bySlot[slot] = contributionFromEquip(it);
      const base = setBaseOfItem(it.item_name ?? '');
      const full = base ? resolveFullSet(base, variantSuffix) : null;
      if (full) slotSet[slot] = full;
    }
    const weapon = equip.find((it) => it.item_equipment_slot === '무기');

    const spec: CharacterSpec = {
      model,
      characterName,
      characterClass: statRes.character_class ?? '',
      isMagic,
      level: Number(basicRes.character_level ?? 0),
      str: m['STR'] ?? 0, dex: m['DEX'] ?? 0, int: m['INT'] ?? 0, luk: m['LUK'] ?? 0, hp: m['HP'] ?? 0,
      attack: isMagic ? (m['마력'] ?? 0) : (m['공격력'] ?? 0),
      damageBossSum: (m['데미지'] ?? 0) + (m['보스 몬스터 데미지'] ?? 0),
      ignoreDef: m['방어율 무시'] ?? 0,
      critRate: m['크리티컬 확률'] ?? 0,
      critDamage: m['크리티컬 데미지'] ?? 0,
      finalDamage: m['최종 데미지'] ?? 0,
      currentWeapon: weapon ? contributionFromEquip(weapon) : null,
      equipmentBySlot: bySlot,
      setCounts,
      slotSet,
    };
    cache.set(characterName, spec);
    return spec;
  } catch (e) {
    return `넥슨 오픈 API 조회 실패: ${(e as Error).message}`;
  }
}
