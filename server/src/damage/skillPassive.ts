// 스킬 패시브 → UserStat. 직업별로 "무조건 상시유지"인 패시브만, 지정 스탯 라인만 파싱한다.
// 값은 skill_effect(현재 레벨 수치)에서 뽑는다 → 스킬레벨 증가 효과로 만렙 넘게 올라도 반영됨.
// 어떤 스킬의 무엇을 넣을지는 유저(도메인 전문가) 확인을 거친 것만. (fill-job-passives 스킬 참고)
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

// 한 스킬에서 지정한 스탯명들만 뽑아 apply. applyName은 apply()가 아는 표준명으로 매핑해서 넘긴다.
function pickInto(us: UserStat, eff: string, picks: { find: string; as?: string }[]): void {
  for (const p of picks) {
    const r = pick(eff, p.find);
    if (r) apply(us, p.as ?? p.find, r.val, r.pct);
  }
}

// 직업별 규칙: grade → (skill_name → 뽑을 스탯 라인). 확인된 상시유지분만.
// cond=true: 액티브 버프 등 "전투 상시"지만 넥슨 resting(final_stat)에는 미포함 —
// 티엘 실측: 샤프 아이즈(버프)를 넣으면 크뎀이 챔피언 뱃지와 이중으로 +15 초과. D(전투) 계산에서만 반영.
type Rule = { picks: { find: string; as?: string }[]; cond?: boolean };
type JobRules = Record<string, Record<string, Rule>>; // grade → skillName → rule

// 직업 공통 규칙 — 0차(비기너/이벤트/연합 스킬)와 5차 쓸만한 시리즈. 보유하지 않으면 스킬명이 안 나와 자동 무시.
const COMMON: JobRules = {
  '0': {
    '연합의 의지': { picks: [{ find: '힘' }, { find: '민첩' }, { find: '지능' }, { find: '행운' }, { find: '공격력' }, { find: '마력' }] },
    '여제의 축복': { picks: [{ find: '공격력' }, { find: '마력' }] },
    '정령의 축복': { picks: [{ find: '공격력' }, { find: '마력' }] }, // 여제와 별도 합산(유저 확인 2026-07-11 재확정)
    // "MP 30 소비하여 2400초 동안 공격력, 마력 4% 증가" — 장시간 버프. resting 미포함(오유찬 마력 +21 초과 실측) → cond.
    '익스클루시브 스펠': { picks: [{ find: '공격력, 마력' }], cond: true },
    '영웅의 메아리': { picks: [{ find: '공격력, 마력' }], cond: true }, // 동일 패턴 버프(2400초) — 전투 상시
    '초월 : 최초의 유산': { picks: [{ find: '공격력' }], cond: true },  // 60초 버프 공10% — 전투 전용
    // 펫 세트효과 스킬("어둠의 다크니스 Lv.1" 류)은 세트 종류가 많아 이름 열거 불가 —
    // 이름 끝 "Lv.N" 패턴으로 일반 처리(PET_SET_RE, 전부 중첩·유저 확인 2026-07-11). 여기 열거 안 함.
    '루나 게더링': { picks: [{ find: '공격력' }, { find: '마력' }] },     // [패시브 효과 : 공격력 15, 마력 15 증가]
    '루나 익스텐션': { picks: [{ find: '공격력' }, { find: '마력' }] },
    '루나 파워업': { picks: [{ find: '공격력' }, { find: '마력' }] },
    '훈련 일지': { picks: [{ find: '공격력/마력' }, { find: '보스 몬스터 공격 시 데미지', as: '보스 몬스터 데미지' }, { find: '몬스터 방어율 무시', as: '방어율 무시' }, { find: '올스탯' }, { find: '크리티컬 확률' }] },
    '초월 : 결전의 의지': { picks: [{ find: '최종 데미지' }, { find: '보스 몬스터 공격 시 데미지', as: '보스 몬스터 데미지' }, { find: '몬스터 방어율 무시', as: '방어율 무시' }] }, // "영구적으로"
  },
  '5': {
    '쓸만한 샤프 아이즈': { picks: [{ find: '크리티컬 확률' }, { find: '크리티컬 데미지' }], cond: true }, // 전투 상시 버프(유저 확인) — resting 미포함
    '쓸만한 어드밴스드 블레스': { picks: [{ find: '공격력' }, { find: '마력' }], cond: true }, // 전투 상시 버프(유저 확인) — resting 미포함
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
    '위크포인트 어택': { picks: [{ find: '크리티컬 확률' }, { find: '크리티컬 데미지' }], cond: true }, // "상태 이상에 걸린 적" 조건부 — 전투 상시(유저 확인), resting 미포함(오유찬 크뎀 잔차 0 실측)
  },
  '4': {
    '웨폰 엑스퍼트': { picks: [{ find: '공격력' }, { find: '크리티컬 확률' }, { find: '크리티컬 데미지' }] },
    '퀵서비스 마인드 Ⅱ': { picks: [{ find: '공격력' }, { find: '크리티컬 데미지' }, { find: '크리티컬 확률' }, { find: '보스 공격 시 데미지', as: '보스 몬스터 데미지' }] }, // Ⅰ과 합산(유저 확인, 오유찬 실측 일치)
    '위크포인트 컨버징 어택': { picks: [{ find: '크리티컬 확률' }, { find: '크리티컬 데미지' }], cond: true }, // 조건부 — 전투 상시, resting 미포함
  },
  '5': {
    '레디 투 다이': { picks: [{ find: '공격력' }], cond: true }, // 공격력 패시브만, 최종뎀 제외(유저 확인) — 버프라 resting 미포함 추정
  },
};

// 보우마스터 — 무조건 상시 패시브만. 액티브 버프(샤프 아이즈·크리티컬 리인포스·퀴버 풀버스트·애로우 레인 등)는
// 유저 승인 전 미반영. 크리티컬 리인포스(크확→크뎀 전환)는 D 계산 최종 단계에서 별도 처리 예정.
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
    '마크맨쉽': { picks: [{ find: '물리 방어율', as: '방어율 무시' }, { find: '공격력' }] }, // 방무25 + 공25%
    '닷지': { picks: [{ find: '최대 HP' }] },
  },
  '4': {
    '보우 엑스퍼트': { picks: [{ find: '공격력' }, { find: '크리티컬 데미지' }] },
    '일루전 스탭': { picks: [{ find: '민첩성' }] },
    '어드밴스드 파이널 어택': { picks: [{ find: '공격력' }] },
    '아머 피어싱': { picks: [{ find: '방어율 무시' }, { find: '최종 데미지' }] },
    '어드밴스드 퀴버': { picks: [{ find: '최종 데미지' }] }, // [패시브 효과 : 최종 데미지 6%]
    '샤프 아이즈': { picks: [{ find: '크리티컬 확률' }, { find: '크리티컬 데미지' }], cond: true }, // 전투 상시 버프 — resting 미포함(크뎀은 챔피언 뱃지로 설명됨). 쓸샤와 배타.
  },
};

const JOB_RULES: Record<string, JobRules> = { '카데나': CADENA, '보우마스터': BOWMASTER };

// 직업 스킬 DB 보유 여부 — 없으면 스킬 패시브만 빠진 채 계산하고 응답에 미반영 노트를 단다.
export function hasJobRules(job: string): boolean {
  return job in JOB_RULES;
}

// 5차 "[패시브 효과 : 올스탯 N]" / "[패시브 효과 : 공격력, 마력 N]" 브래킷 (직업 공통, 액티브에 붙은 패시브).
function collectFifthBrackets(us: UserStat, grade5: SkillEntry[]): void {
  for (const s of grade5) {
    const m = s.skill_effect.match(/\[패시브 효과\s*:\s*([^\]]+)\]/);
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

// 펫 세트효과 스킬: 0차, 이름이 "… Lv.N"으로 끝남 (예: "어둠의 다크니스 Lv.3").
// 세트 종류가 많아 이름 열거 대신 패턴 매칭. Lv.1/2/3 별개 스킬로 전부 중첩(유저 확인 2026-07-11). 공/마만 파싱.
const PET_SET_RE = /Lv\.?\s*\d+$/;
const PET_SET_PICKS = [{ find: '공격력' }, { find: '마력' }];

export function collectSkillPassive(us: UserStat, job: string, skills: SkillsByGrade, includeConditional = false): void {
  // 쓸만한 X(5차)는 본체 X 스킬과 중첩 불가(유저 확인 2026-07-11) — 본체 보유 시 쓸만한 규칙을 스킵.
  // 예: 보마는 샤프 아이즈(4차)를 쓰므로 쓸만한 샤프 아이즈(10/8)가 아닌 본체(20/15)만 적용.
  const owned = new Set<string>();
  for (const arr of Object.values(skills)) for (const s of arr) owned.add(s.skill_name);
  for (const rules of [COMMON, JOB_RULES[job]]) {
    if (!rules) continue;
    for (const [grade, byName] of Object.entries(rules)) {
      for (const s of skills[grade] ?? []) {
        const rule = byName[s.skill_name];
        if (!rule) continue;
        if (rule.cond && !includeConditional) continue;
        if (s.skill_name.startsWith('쓸만한 ') && owned.has(s.skill_name.slice('쓸만한 '.length))) continue;
        pickInto(us, s.skill_effect, rule.picks);
      }
    }
  }
  for (const s of skills['0'] ?? []) {
    if (PET_SET_RE.test(s.skill_name.trim())) pickInto(us, s.skill_effect, PET_SET_PICKS);
  }
  collectFifthBrackets(us, skills['5'] ?? []);
}
