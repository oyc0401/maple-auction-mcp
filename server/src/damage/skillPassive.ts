// 스킬 패시브 → UserStat. 직업별로 상시 유지로 취급하는 패시브·버프만, 지정 스탯 라인만 파싱한다.
// 값은 skill_effect(현재 레벨 수치)에서 뽑으므로 스킬레벨 증가 효과로 만렙을 넘어도 반영된다.
// 등재 기준과 절차는 fill-job-passives 스킬 참고.
import type { UserStat } from './statSheet.js';
import { apply } from './parse.js';

export interface SkillEntry { skill_name: string; skill_level: number; skill_effect: string }
export type SkillsByGrade = Record<string, SkillEntry[]>; // '0'..'6','hyperpassive'

// effect 문자열에서 "이름 [+]값[%]" 첫 매치의 값. 없으면 null.
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

// 직업별 규칙: grade → (skill_name → 뽑을 스탯 라인).
// bracket=true: 액티브 스킬 effect 안의 "[패시브 효과 : …]" 브래킷 내부에서만 뽑는다 —
// 본문에 같은 스탯명이 조건부 수치로 먼저 나오는 스킬의 오매치 방지.
type Rule = { picks: { find: string; as?: string }[]; bracket?: boolean };
type JobRules = Record<string, Record<string, Rule>>; // grade → skillName → rule

// 직업 공통 규칙 — 0차(비기너/이벤트/연합 스킬)와 5차 쓸만한 시리즈. 보유하지 않으면 스킬명이 안 나와 자동 무시.
const COMMON: JobRules = {
  '0': {
    '연합의 의지': { picks: [{ find: '힘' }, { find: '민첩' }, { find: '지능' }, { find: '행운' }, { find: '공격력' }, { find: '마력' }] },
    '여제의 축복': { picks: [{ find: '공격력' }, { find: '마력' }] },
    '정령의 축복': { picks: [{ find: '공격력' }, { find: '마력' }] }, // 여제의 축복과 중복 불가 — 높은 쪽 1개만(character.ts blessSkip에서 판정, 유저 확인 2026-07-12)
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
    '퀵서비스 마인드 Ⅱ': { picks: [{ find: '공격력' }, { find: '크리티컬 데미지' }, { find: '크리티컬 확률' }, { find: '보스 공격 시 데미지', as: '보스 몬스터 데미지' }] }, // Ⅰ과 합산
    '위크포인트 컨버징 어택': { picks: [{ find: '크리티컬 확률' }, { find: '크리티컬 데미지' }] },
  },
  '5': {
    '레디 투 다이': { picks: [{ find: '공격력' }] }, // 공격력 패시브만, 최종뎀 제외
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

// 캡틴 — 액티브·조건부(럭키/더블럭키 다이스, 파이렛 스타일, 오펜스 폼, 크루 소환 중 보너스)는 미반영.
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
    '풀메탈 자켓': { picks: [{ find: '최종 데미지' }, { find: '크리티컬 확률' }, { find: '몬스터 방어율', as: '방어율 무시' }] }, // "몬스터 방어율 20% 무시" 어순이라 '몬스터 방어율'로 수치를 잡는다
  },
  '4': {
    '컨티뉴얼 에이밍': { bracket: true, picks: [{ find: '최종 데미지' }, { find: '크리티컬 데미지' }] },
    '크루 커맨더십': { bracket: true, picks: [{ find: '크리티컬 데미지' }] }, // 본문 크뎀은 선원 소환 중 조건부라 브래킷만
    '캡틴 디그니티': { picks: [{ find: '최종 데미지' }, { find: '공격력' }] },
  },
};

const JOB_RULES: Record<string, JobRules> = { '카데나': CADENA, '보우마스터': BOWMASTER, '캡틴': CAPTAIN };

const RE_PASSIVE_BRACKET = /\[패시브 효과\s*:\s*([^\]]+)\]/;

// 5차 "[패시브 효과 : 올스탯 N]" / "[패시브 효과 : 공격력, 마력 N]" 브래킷 (직업 공통, 액티브에 붙은 패시브).
function collectFifthBrackets(us: UserStat, grade5: SkillEntry[]): void {
  for (const s of grade5) {
    const m = s.skill_effect.match(RE_PASSIVE_BRACKET);
    if (!m) continue;
    const body = m[1];
    const all = pick(body, '올스탯');
    if (all) apply(us, '올스탯', all.val, all.pct);
    // "공격력, 마력 30 증가"는 결합 표기 — 콤마 결합이면 양쪽에, 아니면 각각 개별 매치.
    const both = pick(body, '공격력, 마력');
    if (both) { apply(us, '공격력', both.val, both.pct); apply(us, '마력', both.val, both.pct); }
    else {
      const atk = pick(body, '공격력'); if (atk) apply(us, '공격력', atk.val, atk.pct);
      const matk = pick(body, '마력'); if (matk) apply(us, '마력', matk.val, matk.pct);
    }
  }
}

// 펫 세트효과 스킬: 0차, 이름이 "… Lv.N"으로 끝난다. 세트 종류가 많아 열거 대신 패턴 매칭. 전부 중첩, 공/마만 파싱.
const PET_SET_RE = /Lv\.?\s*\d+$/;
const PET_SET_PICKS = [{ find: '공격력' }, { find: '마력' }];

// ownedOverride: 스킬 일부만 담은 skills로 단건 재집계할 때(character.ts) 전체 보유 목록을 주입한다.
// 쓸만한 게이팅은 룰 적용만 막고 5차 브래킷 패시브는 계속 집계해야 하므로 호출부에서 스킬을 미리 걸러내면 안 된다.
export function collectSkillPassive(us: UserStat, job: string, skills: SkillsByGrade, ownedOverride?: Set<string>): void {
  // 쓸만한 X(5차)는 본체 X 스킬과 중첩 불가 — 본체 보유 시 쓸만한 규칙을 스킵.
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
  collectFifthBrackets(us, skills['5'] ?? []);
}
