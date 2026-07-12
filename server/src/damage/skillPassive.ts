import type { UserStat } from './statSheet.js';
import { apply, accumIncrease } from './parse.js';

export interface SkillEntry { skill_name: string; skill_level: number; skill_effect: string }
export type SkillsByGrade = Record<string, SkillEntry[]>;

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

type Rule = { picks: { find: string; as?: string }[]; bracket?: boolean };
type JobRules = Record<string, Record<string, Rule>>;

const COMMON: JobRules = {
  '0': {
    '연합의 의지': { picks: [{ find: '힘' }, { find: '민첩' }, { find: '지능' }, { find: '행운' }, { find: '공격력' }, { find: '마력' }] },
    '여제의 축복': { picks: [{ find: '공격력' }, { find: '마력' }] },
    '정령의 축복': { picks: [{ find: '공격력' }, { find: '마력' }] },
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

function collectFifthBrackets(us: UserStat, grade5: SkillEntry[]): void {
  for (const s of grade5) {
    const m = s.skill_effect.match(RE_PASSIVE_BRACKET);
    if (!m) continue;
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
}

const PET_SET_RE = /Lv\.?\s*\d+$/;
const PET_SET_PICKS = [{ find: '공격력' }, { find: '마력' }];

export function collectSkillPassive(us: UserStat, job: string, skills: SkillsByGrade, ownedOverride?: Set<string>): void {
  const owned = ownedOverride ?? new Set<string>();
  if (!ownedOverride) for (const arr of Object.values(skills)) for (const s of arr) owned.add(s.skill_name);
  for (const rules of [COMMON, JOB_RULES[job]]) {
    if (!rules) continue;
    for (const [grade, byName] of Object.entries(rules)) {
      for (const s of skills[grade] ?? []) {
        const rule = byName[s.skill_name];
        if (!rule) continue;
        if (s.skill_name.startsWith('쓸만한 ') && owned.has(s.skill_name.slice('쓸만한 '.length))) continue;
        const eff = rule.bracket ? (s.skill_effect.match(RE_PASSIVE_BRACKET)?.[1] ?? '') : s.skill_effect;
        pickInto(us, eff, rule.picks);
      }
    }
  }
  for (const s of skills['0'] ?? []) {
    if (PET_SET_RE.test(s.skill_name.trim())) pickInto(us, s.skill_effect, PET_SET_PICKS);
  }
  // 0차 동적 폴백: 명시 룰·펫 세트에 안 걸린 0차 스킬(달콤하담 등 열거 불가한 이벤트성 상시 패시브)의
  // 능력치 증가 라인을 줄 단위로 파싱. "N분/초 동안" 지속버프 라인은 액티브라 제외.
  // 환산 무관 문구(경험치·수영속도 등)는 apply가 조용히 무시. 결계의 핵 소환처럼 수치가 아이템에
  // 있는 스킬은 effect에 능력치가 없어 아무것도 안 나온다(API 미노출 — 잔차로 드러남).
  const ruled0 = new Set([...Object.keys(COMMON['0'] ?? {}), ...Object.keys(JOB_RULES[job]?.['0'] ?? {})]);
  for (const s of skills['0'] ?? []) {
    if (ruled0.has(s.skill_name) || PET_SET_RE.test(s.skill_name.trim())) continue;
    for (const line of String(s.skill_effect ?? '').split('\n')) {
      if (/\d+\s*(분|초)\s*동안/.test(line)) continue;
      accumIncrease(us, line);
    }
  }
  collectFifthBrackets(us, skills['5'] ?? []);
}
