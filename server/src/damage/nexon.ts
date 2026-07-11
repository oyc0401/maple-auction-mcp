// 넥슨 오픈 API 클라이언트 (환산/데미지 계산용 캐릭터 스탯 조회).
// 경매장 API(브릿지/확장)와 달리 공개 API + 개발자 키 인증이라 서버가 직접 호출한다.
// 키는 NEXON_DEVELOPER_KEY(.env). 없으면 환산 기능만 비활성(검색은 정상).
// 레이트리밋이 약해 순차 호출 + 429 지수 백오프. 캐릭터당 프로세스 생존 동안 캐시.
import { emptyUserStat, type UserStat } from './statSheet.js';
import {
  collectGear, collectSet, collectSymbol, collectHyper, collectAbility, collectBaseAP, collectUnion, collectArtifact, collectTitle, collectMapleWarrior,
} from './collect.js';
import { collectJobPassive } from './jobPassive.js';
import { collectLinkSkills } from './linkSkill.js';
import { collectSkillPassive, type SkillsByGrade } from './skillPassive.js';
import { collectHexaStat } from './hexaStat.js';

const MAIN_KEYS = ['STR', 'DEX', 'INT', 'LUK'] as const;
type MainKey = (typeof MAIN_KEYS)[number];
function mainStatKey(m: Record<string, number>): MainKey {
  return MAIN_KEYS.reduce((a, b) => ((m[b] ?? 0) >= (m[a] ?? 0) ? b : a), 'LUK' as MainKey);
}

const BASE = 'https://open.api.nexon.com/maplestory/v1';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function nexonApiKey(): string | undefined {
  return process.env.NEXON_DEVELOPER_KEY || undefined;
}

async function getJson(path: string, params: Record<string, string>, key: string): Promise<any> {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'x-nxopen-api-key': key } });
    if (res.ok) return res.json();
    if (res.status === 429 && attempt < 5) { await sleep(600 * 2 ** attempt); continue; }
    let detail = '';
    try { detail = JSON.stringify(await res.json()); } catch { /* ignore */ }
    throw new Error(`넥슨 오픈 API ${res.status} ${path} ${detail}`);
  }
}

function statMap(finalStat: { stat_name: string; stat_value: string }[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const s of finalStat ?? []) m[s.stat_name] = Number(s.stat_value);
  return m;
}

// 캐릭터 최종 종합 스탯(검증 오라클) + 직업.
export interface CharFinal {
  characterName: string;
  characterClass: string;
  level: number;
  finalMain: Record<string, number>; // STR/DEX/INT/LUK/HP 최종값
  statAtkMin: number; statAtkMax: number; // 최소/최대 스탯공격력
  raw: Record<string, number>;       // final_stat 전체 맵
}

export interface CharacterCollected {
  final: CharFinal;
  userStat: UserStat; // 소스에서 모은 값 (재구성 대조 대상)
  warnings: string[]; // 조회 실패한 소스 (best-effort — 있으면 그 스탯이 누락됨)
  raw: Record<string, any>; // 진단용 원본 응답 (base/gear/set/symbol/hyper/ability/union)
}

const cache = new Map<string, CharacterCollected>();
export function clearNexonCache() { cache.clear(); }

// 넥슨 API 원본 응답 묶음 — 집계(aggregate)와 분리해 디스크 캐시/재집계가 가능하도록.
export interface RawBundle {
  stat: any; basic: any;
  equip: any; setEff: any; symbol: any; hyper: any; ability: any; link: any; union: any; artifact: any;
  skills: SkillsByGrade; hexa: any;
}

// 닉네임 → 전 소스 순차 조회(레이트리밋 준수). API를 실제로 쏘는 유일한 지점.
export async function fetchCharacterRaw(characterName: string): Promise<{ raw: RawBundle; warnings: string[] }> {
  const key = nexonApiKey();
  if (!key) throw new Error('NEXON_DEVELOPER_KEY 미설정');

  const { ocid } = await getJson('/id', { character_name: characterName }, key);
  if (!ocid) throw new Error(`캐릭터를 찾지 못했습니다: ${characterName}`);

  // 순차 호출(레이트리밋). 각 호출 사이 짧은 간격.
  const gap = () => sleep(250);
  const warnings: string[] = [];
  // stat은 필수(검증 오라클). 나머지는 best-effort — 실패하면 그 스탯만 누락하고 경고.
  const stat = await getJson('/character/stat', { ocid }, key); await gap();
  const basic = await getJson('/character/basic', { ocid }, key).catch(() => ({})); await gap();
  const opt = async (label: string, path: string, extra: Record<string, string> = {}) => {
    try { const r = await getJson(path, { ocid, ...extra }, key); await gap(); return r; }
    catch (e) { warnings.push(`${label} 조회 실패: ${(e as Error).message}`); return null; }
  };
  const equip = await opt('장비', '/character/item-equipment');
  const setEff = await opt('세트효과', '/character/set-effect');
  const symbol = await opt('심볼', '/character/symbol-equipment');
  const hyper = await opt('하이퍼스탯', '/character/hyper-stat');
  const ability = await opt('어빌리티', '/character/ability');
  const link = await opt('링크스킬', '/character/link-skill');
  const union = await opt('유니온', '/user/union-raider'); // 유니온은 /user/ 경로 (character 아님)
  const artifact = await opt('유니온 아티팩트', '/user/union-artifact');
  // 스킬 패시브: 0~5차만(하이퍼패시브·6차 액티브 제외, 6차 HEXA는 hexamatrix-stat). best-effort.
  const skills: SkillsByGrade = {};
  for (const grade of ['0', '1', '2', '3', '4', '5']) {
    const r = await opt(`스킬${grade}차`, '/character/skill', { character_skill_grade: grade });
    if (r) skills[grade] = r.character_skill ?? [];
  }
  const hexa = await opt('HEXA스탯', '/character/hexamatrix-stat');

  return { raw: { stat, basic, equip, setEff, symbol, hyper, ability, link, union, artifact, skills, hexa }, warnings };
}

// 원본 응답 묶음 → UserStat 집계 + 검증 오라클. API 호출 없음(디스크 캐시 재집계 가능).
export function aggregateCharacter(characterName: string, bundle: RawBundle, warnings: string[]): CharacterCollected {
  const { stat, basic, equip, setEff, symbol, hyper, ability, link, union, artifact, skills, hexa } = bundle;
  const m = statMap(stat.final_stat);
  const level = Number(basic?.character_level ?? 0);
  const us = emptyUserStat();
  collectBaseAP(us, m);
  collectMapleWarrior(us, m, skills);
  if (equip) { collectGear(us, equip.item_equipment, level); collectTitle(us, equip); }
  if (setEff) collectSet(us, setEff.set_effect);
  if (symbol) collectSymbol(us, symbol.symbol);
  if (hyper) collectHyper(us, hyper[`hyper_stat_preset_${hyper.use_preset_no ?? 1}`]);
  if (ability) collectAbility(us, ability.ability_info);
  if (link) collectLinkSkills(us, link);
  if (union) collectUnion(us, union);
  if (artifact) collectArtifact(us, artifact);
  collectJobPassive(us, stat.character_class ?? '');
  const mainKey = mainStatKey(m);
  const cls = stat.character_class ?? '';
  const job = cls === '제논' ? 'xenon' : cls === '데몬어벤져' ? 'deven' : 'normal';
  collectSkillPassive(us, cls, skills);
  if (hexa) collectHexaStat(us, hexa, mainKey, mainKey === 'INT', job);

  const collected: CharacterCollected = {
    final: {
      characterName,
      characterClass: stat.character_class ?? basic.character_class ?? '',
      level: Number(basic.character_level ?? 0),
      finalMain: { STR: m['STR'] ?? 0, DEX: m['DEX'] ?? 0, INT: m['INT'] ?? 0, LUK: m['LUK'] ?? 0, HP: m['HP'] ?? 0 },
      statAtkMin: m['최소 스탯공격력'] ?? 0,
      statAtkMax: m['최대 스탯공격력'] ?? 0,
      raw: m,
    },
    userStat: us,
    warnings,
    raw: { statMap: m, equip, setEff, symbol, hyper, ability, union, skills, hexa, class: stat.character_class ?? '', mainKey, bundle },
  };
  return collected;
}

// 닉네임 → 조회 + 집계. 캐릭터당 프로세스 생존 동안 캐시(중복 호출 방지).
export async function collectCharacter(characterName: string): Promise<CharacterCollected> {
  const hit = cache.get(characterName);
  if (hit) return hit;
  const { raw, warnings } = await fetchCharacterRaw(characterName);
  const collected = aggregateCharacter(characterName, raw, warnings);
  cache.set(characterName, collected);
  return collected;
}
