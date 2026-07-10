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
type Rule = { picks: { find: string; as?: string }[] };
type JobRules = Record<string, Record<string, Rule>>; // grade → skillName → rule

const CADENA: JobRules = {
  '0': {
    '연합의 의지': { picks: [{ find: '힘' }, { find: '민첩' }, { find: '지능' }, { find: '행운' }, { find: '공격력' }, { find: '마력' }] },
    '여제의 축복': { picks: [{ find: '공격력' }, { find: '마력' }] },
    '정령의 축복': { picks: [{ find: '공격력' }, { find: '마력' }] }, // 여제와 별도 합산(유저 확인)
    '익스클루시브 스펠': { picks: [{ find: '공격력' }, { find: '마력' }] }, // 공/마 4% (pct는 effect가 %로 표기)
  },
  '1': {
    '콜렉팅 포리프': { picks: [{ find: '행운' }] },
  },
  '2': {
    '피지컬 트레이닝': { picks: [{ find: '행운' }, { find: '민첩성' }] },
    '퀵서비스 마인드 Ⅰ': { picks: [{ find: '공격력' }, { find: '크리티컬 데미지' }, { find: '크리티컬 확률' }] },
  },
  '3': {
    '베이직 디텍션': { picks: [{ find: '방어율 무시' }, { find: '데미지', as: '데미지' }, { find: '최종 데미지' }] },
    '위크포인트 어택': { picks: [{ find: '크리티컬 확률' }, { find: '크리티컬 데미지' }] }, // 상시(유저 확인)
  },
  '4': {
    '웨폰 엑스퍼트': { picks: [{ find: '공격력' }, { find: '크리티컬 확률' }, { find: '크리티컬 데미지' }] },
    '퀵서비스 마인드 Ⅱ': { picks: [{ find: '공격력' }, { find: '크리티컬 데미지' }, { find: '크리티컬 확률' }, { find: '보스 공격 시 데미지', as: '보스 몬스터 데미지' }] }, // Ⅰ과 합산
    '위크포인트 컨버징 어택': { picks: [{ find: '크리티컬 확률' }, { find: '크리티컬 데미지' }] }, // 상시(유저 확인)
  },
  '5': {
    '쓸만한 샤프 아이즈': { picks: [{ find: '크리티컬 확률' }, { find: '크리티컬 데미지' }] }, // 상시(유저 확인)
    '쓸만한 어드밴스드 블레스': { picks: [{ find: '공격력' }, { find: '마력' }] }, // 상시(유저 확인)
    '레디 투 다이': { picks: [{ find: '공격력' }] }, // 공격력 패시브만, 최종뎀 제외(유저 확인)
  },
};

const JOB_RULES: Record<string, JobRules> = { '카데나': CADENA };

// 5차 "[패시브 효과 : 올스탯 N]" / "[패시브 효과 : 공격력, 마력 N]" 브래킷 (직업 공통, 액티브에 붙은 패시브).
function collectFifthBrackets(us: UserStat, grade5: SkillEntry[]): void {
  for (const s of grade5) {
    const m = s.skill_effect.match(/\[패시브 효과\s*:\s*([^\]]+)\]/);
    if (!m) continue;
    const body = m[1];
    const all = pick(body, '올스탯');
    if (all) apply(us, '올스탯', all.val, all.pct);
    const atk = pick(body, '공격력'); if (atk) apply(us, '공격력', atk.val, atk.pct);
    const matk = pick(body, '마력'); if (matk) apply(us, '마력', matk.val, matk.pct);
  }
}

export function collectSkillPassive(us: UserStat, job: string, skills: SkillsByGrade): void {
  const rules = JOB_RULES[job];
  if (rules) {
    for (const [grade, byName] of Object.entries(rules)) {
      for (const s of skills[grade] ?? []) {
        const rule = byName[s.skill_name];
        if (rule) pickInto(us, s.skill_effect, rule.picks);
      }
    }
  }
  collectFifthBrackets(us, skills['5'] ?? []);
}
