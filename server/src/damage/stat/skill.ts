// 스킬 패시브 → CharacterStats 스킬 파트. getSkill 하나로 차수별 블록·메용%·크리인포를 다 뽑는다.
// 값은 skill_effect(현재 레벨 수치)에서 파싱 — 스킬레벨 증가 효과로 만렙을 넘어도 반영된다.
// 등재 기준과 절차는 fill-job-passives 스킬 참고.
import type { UserStat } from '../statSheet.js';
import type { StatBlock, CharacterStats } from '../stat-interface.js';
import { apply, accumIncrease } from '../parse.js';
import { blockOf, isEmptyBlock } from '../block.js';
import type { SkillEntry, SkillsByGrade } from '../nexon.js';

function pick(effect: string, name: string): { val: number; pct: boolean } | null {
  const re = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\+?\\s*(-?\\d+(?:\\.\\d+)?)\\s*(%?)');
  const m = effect.match(re);
  return m ? { val: Number(m[1]), pct: m[2] === '%' } : null;
}

function pickInto(us: UserStat, eff: string, picks: { find: string; as?: string }[]): void {
  for (const p of picks) {
    const r = pick(eff, p.find);
    if (r) apply(us, p.as ?? p.find, r.val, r.pct);
  }
}

// bracket=true: 액티브 스킬 effect 안의 "[패시브 효과 : …]" 내부에서만 뽑는다(본문 조건부 수치 오매치 방지).
type Rule = { picks: { find: string; as?: string }[]; bracket?: boolean };
type JobRules = Record<string, Record<string, Rule>>;

const COMMON: JobRules = {
  '0': {
    '연합의 의지': { picks: [{ find: '힘' }, { find: '민첩' }, { find: '지능' }, { find: '행운' }, { find: '공격력' }, { find: '마력' }] },
    '여제의 축복': { picks: [{ find: '공격력' }, { find: '마력' }] },
    '정령의 축복': { picks: [{ find: '공격력' }, { find: '마력' }] }, // 여제와 중복 불가 — 높은 쪽 1개만(getSkill의 blessSkip)
    '익스클루시브 스펠': { picks: [{ find: '공격력, 마력' }] },
    '영웅의 메아리': { picks: [{ find: '공격력, 마력' }] },
    '초월 : 최초의 유산': { picks: [{ find: '공격력' }] },
    '루나 게더링': { picks: [{ find: '공격력' }, { find: '마력' }] },
    '루나 익스텐션': { picks: [{ find: '공격력' }, { find: '마력' }] },
    '루나 파워업': { picks: [{ find: '공격력' }, { find: '마력' }] },
    '훈련 일지': { picks: [{ find: '공격력/마력' }, { find: '보스 몬스터 공격 시 데미지', as: '보스 몬스터 데미지' }, { find: '몬스터 방어율 무시', as: '방어율 무시' }, { find: '올스탯' }, { find: '크리티컬 확률' }] },
    '초월 : 결전의 의지': { picks: [{ find: '최종 데미지' }, { find: '보스 몬스터 공격 시 데미지', as: '보스 몬스터 데미지' }, { find: '몬스터 방어율 무시', as: '방어율 무시' }] },
  },
  '5': {
    '쓸만한 샤프 아이즈': { picks: [{ find: '크리티컬 확률' }, { find: '크리티컬 데미지' }] },
    '쓸만한 어드밴스드 블레스': { picks: [{ find: '공격력' }, { find: '마력' }] },
  },
};

const CADENA: JobRules = {
  '1': {
    '콜렉팅 포리프': { picks: [{ find: '행운' }] },
  },
  '2': {
    '피지컬 트레이닝': { picks: [{ find: '행운' }, { find: '민첩성' }] },
    '퀵서비스 마인드 Ⅰ': { picks: [{ find: '공격력' }, { find: '크리티컬 데미지' }, { find: '크리티컬 확률' }] },
  },
  '3': {
    '베이직 디텍션': { picks: [{ find: '방어율 무시' }, { find: '데미지', as: '데미지' }, { find: '최종 데미지' }] },
    '위크포인트 어택': { picks: [{ find: '크리티컬 확률' }, { find: '크리티컬 데미지' }] },
  },
  '4': {
    '웨폰 엑스퍼트': { picks: [{ find: '공격력' }, { find: '크리티컬 확률' }, { find: '크리티컬 데미지' }] },
    '퀵서비스 마인드 Ⅱ': { picks: [{ find: '공격력' }, { find: '크리티컬 데미지' }, { find: '크리티컬 확률' }, { find: '보스 공격 시 데미지', as: '보스 몬스터 데미지' }] },
    '위크포인트 컨버징 어택': { picks: [{ find: '크리티컬 확률' }, { find: '크리티컬 데미지' }] },
  },
  '5': {
    '레디 투 다이': { picks: [{ find: '공격력' }] },
  },
};

const BOWMASTER: JobRules = {
  '1': {
    '크리티컬 샷': { picks: [{ find: '크리티컬 확률' }] },
  },
  '2': {
    '보우 액셀레이션': { picks: [{ find: '민첩성' }] },
    '소울 애로우 : 활': { picks: [{ find: '공격력' }] },
    '피지컬 트레이닝': { picks: [{ find: '힘' }, { find: '민첩성' }] },
  },
  '3': {
    '익스트림 아쳐리 : 활': { picks: [{ find: '공격력' }, { find: '최종 데미지' }] },
    '마크맨쉽': { picks: [{ find: '물리 방어율', as: '방어율 무시' }, { find: '공격력' }] },
    '닷지': { picks: [{ find: '최대 HP' }] },
  },
  '4': {
    '보우 엑스퍼트': { picks: [{ find: '공격력' }, { find: '크리티컬 데미지' }] },
    '일루전 스탭': { picks: [{ find: '민첩성' }] },
    '어드밴스드 파이널 어택': { picks: [{ find: '공격력' }] },
    '아머 피어싱': { picks: [{ find: '방어율 무시' }, { find: '최종 데미지' }] },
    '어드밴스드 퀴버': { picks: [{ find: '최종 데미지' }] },
    '샤프 아이즈': { picks: [{ find: '크리티컬 확률' }, { find: '크리티컬 데미지' }] },
  },
};

const CAPTAIN: JobRules = {
  '1': {
    '크리티컬 로어': { picks: [{ find: '크리티컬 확률' }, { find: '크리티컬 데미지' }] },
  },
  '2': {
    '인피닛 불릿': { picks: [{ find: '공격력' }] },
    '건 액셀레이션': { picks: [{ find: '민첩성' }] },
    '건 마스터리': { picks: [{ find: '크리티컬 확률' }] },
    '피지컬 트레이닝': { picks: [{ find: '힘' }, { find: '민첩성' }] },
  },
  '3': {
    '할로포인트 불릿': { picks: [{ find: '공격력' }] },
    '풀메탈 자켓': { picks: [{ find: '최종 데미지' }, { find: '크리티컬 확률' }, { find: '몬스터 방어율', as: '방어율 무시' }] },
  },
  '4': {
    '컨티뉴얼 에이밍': { bracket: true, picks: [{ find: '최종 데미지' }, { find: '크리티컬 데미지' }] },
    '크루 커맨더십': { bracket: true, picks: [{ find: '크리티컬 데미지' }] },
    '캡틴 디그니티': { picks: [{ find: '최종 데미지' }, { find: '공격력' }] },
  },
};

const JOB_RULES: Record<string, JobRules> = { '카데나': CADENA, '보우마스터': BOWMASTER, '캡틴': CAPTAIN };

const RE_PASSIVE_BRACKET = /\[패시브 효과\s*:\s*([^\]]+)\]/;
const PET_SET_RE = /Lv\.?\s*\d+$/; // 펫 세트효과 스킬(0차) — 종류가 많아 이름 패턴 매칭, 전부 중첩
const PET_SET_PICKS = [{ find: '공격력' }, { find: '마력' }];

// 5차 "[패시브 효과 : 올스탯/공마 N]" 브래킷 — 직업 공통(액티브에 붙은 패시브)
function bracket5(us: UserStat, s: SkillEntry): void {
  const m = s.skill_effect.match(RE_PASSIVE_BRACKET);
  if (!m) return;
  const body = m[1];
  const all = pick(body, '올스탯');
  if (all) apply(us, '올스탯', all.val, all.pct);
  const both = pick(body, '공격력, 마력');
  if (both) { apply(us, '공격력', both.val, both.pct); apply(us, '마력', both.val, both.pct); }
  else {
    const atk = pick(body, '공격력'); if (atk) apply(us, '공격력', atk.val, atk.pct);
    const matk = pick(body, '마력'); if (matk) apply(us, '마력', matk.val, matk.pct);
  }
}

// 스킬 1개의 기여. owned: 전체 보유 스킬명(쓸만한 X는 본체 X 보유 시 스킵).
function collectOne(us: UserStat, job: string, grade: string, s: SkillEntry, owned: Set<string>): void {
  let ruled = false;
  for (const rules of [COMMON, JOB_RULES[job]]) {
    const rule = rules?.[grade]?.[s.skill_name];
    if (!rule) continue;
    ruled = true;
    if (s.skill_name.startsWith('쓸만한 ') && owned.has(s.skill_name.slice('쓸만한 '.length))) continue;
    const eff = rule.bracket ? (s.skill_effect.match(RE_PASSIVE_BRACKET)?.[1] ?? '') : s.skill_effect;
    pickInto(us, eff, rule.picks);
  }
  if (grade === '0' && PET_SET_RE.test(s.skill_name.trim())) {
    pickInto(us, s.skill_effect, PET_SET_PICKS);
  } else if ((grade === '0' || grade === 'hyperpassive') && !ruled) {
    // 동적 폴백: 룰·펫 세트 밖 0차/하이퍼 패시브(달콤하담 등 이벤트성 상시 패시브)의 능력치 라인을
    // 줄 단위 파싱. "N분/초 동안" 지속버프 라인은 액티브라 제외. 특정 스킬 강화("X의 데미지 20% 증가")
    // 류·환산 무관 문구는 apply가 표준 스탯명 불일치로 조용히 무시.
    for (const line of String(s.skill_effect ?? '').split('\n')) {
      if (/\d+\s*(분|초)\s*동안/.test(line)) continue;
      accumIncrease(us, line);
    }
  }
  if (grade === '5') bracket5(us, s);
}

// 여제의 축복 vs 정령의 축복: 중복 불가 — 공격력 높은 쪽 1개만(여제 툴팁 명시, 유저 확인 2026-07-12).
function blessSkipOf(skills: SkillsByGrade): Set<string> {
  const atkOf = (name: string): number => {
    for (const arr of Object.values(skills)) {
      for (const s of arr) if (s.skill_name === name) return pick(s.skill_effect ?? '', '공격력')?.val ?? -1;
    }
    return -1;
  };
  const skip = new Set<string>();
  const emp = atkOf('여제의 축복'), spi = atkOf('정령의 축복');
  if (emp >= 0 && spi >= 0) skip.add(emp >= spi ? '정령의 축복' : '여제의 축복');
  return skip;
}

type SkillStats = Pick<CharacterStats,
  '메이플용사' | '크리티컬리인포스' | '스킬_0차' | '스킬_1차' | '스킬_2차' | '스킬_3차' | '스킬_4차' | '스킬_하이퍼' | '스킬_5차'>;

// 배열 순서 = CharacterStats 필드 순서 (객체 리터럴은 숫자형 키가 먼저 돌아 하이퍼 위치를 못 지킨다)
const GRADE_FIELD = [
  ['0', '스킬_0차'], ['1', '스킬_1차'], ['2', '스킬_2차'], ['3', '스킬_3차'], ['4', '스킬_4차'],
  ['hyperpassive', '스킬_하이퍼'], ['5', '스킬_5차'],
] as const;

// 스킬 원본(SkillsByGrade) → CharacterStats 스킬 파트 통째로.
export function getSkill(job: string, skills: SkillsByGrade | undefined): SkillStats {
  const out: SkillStats = {};
  if (!skills) return out;
  const owned = new Set<string>();
  for (const arr of Object.values(skills)) for (const s of arr) owned.add(s.skill_name);
  const blessSkip = blessSkipOf(skills);

  for (const [grade, field] of GRADE_FIELD) {
    for (const s of skills[grade] ?? []) {
      if (blessSkip.has(s.skill_name)) continue;
      const b: StatBlock = blockOf((u) => collectOne(u, job, grade, s, owned));
      if (isEmptyBlock(b)) continue;
      (out[field] ??= {})[s.skill_name] = b;
    }
  }

  // 메이플 용사: AP 직접투자 스탯 N% — N만 저장(환산은 flattenStats). 직업마다 스킬명이 달라 패턴 파싱.
  for (const arr of Object.values(skills)) {
    for (const s of arr) {
      const m = String(s.skill_effect ?? '').match(/AP를 직접 투자한 모든 능력치\s*(\d+(?:\.\d+)?)\s*%/);
      if (m) { out.메이플용사 = Number(m[1]); break; }
    }
    if (out.메이플용사) break;
  }
  // 크리티컬 리인포스(5차 공용): 크확의 50%를 크뎀으로 전환 — 보유만 기록, 전환은 combat.ts.
  if ((skills['5'] ?? []).some((s) => s.skill_name === '크리티컬 리인포스')) out.크리티컬리인포스 = 50;
  return out;
}
