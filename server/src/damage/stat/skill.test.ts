import { describe, expect, it } from 'vitest';
import type { SkillEntry, SkillGrade, SkillRes } from '../../nexon/index.js';
import { getCriticalReinforce, getMapleWarrior } from './skill.js';

function createSkillRes(grade: SkillGrade, skills: Array<Partial<SkillEntry>>): SkillRes {
  return {
    date: null,
    character_class: '테스트',
    character_skill_grade: grade,
    character_skill: skills.map((skill) => ({
      skill_name: '',
      skill_description: '',
      skill_level: 0,
      skill_effect: null,
      skill_icon: '',
      ...skill,
    })),
  };
}

describe('특수 스킬 수치 변환', () => {
  it.each([
    ['메이플 용사', 16],
    ['시그너스 나이츠', 15],
    ['노바의 용사', 15],
    ['레프의 용사', 14],
    ['아니마의 용사', 15],
    ['이계의 용사', 15],
    ['륀느의 가호', 15],
  ])('%s의 AP 증가율을 효과에서 추출한다', (skillName, expected) => {
    const skill4 = createSkillRes('4', [{
      skill_name: skillName,
      skill_effect: `[패시브 효과 : AP를 직접 투자한 모든 능력치 ${expected}% 증가]`,
    }]);

    expect(getMapleWarrior(skill4)).toBe(expected);
  });

  it('다른 AP 증가 스킬은 메이플 용사로 오인하지 않는다', () => {
    const skill4 = createSkillRes('4', [{
      skill_name: '파이렛 플래그',
      skill_effect: '파티원의 AP를 직접 투자한 모든 능력치 25% 증가',
    }]);

    expect(getMapleWarrior(skill4)).toBe(0);
  });

  it('크리티컬 리인포스의 크확 대비 크뎀 비율을 추출한다', () => {
    const skill5 = createSkillRes('5', [{
      skill_name: '크리티컬 리인포스',
      skill_effect: '크리티컬 확률의 50% 만큼 크리티컬 데미지 증가',
    }]);

    expect(getCriticalReinforce(skill5)).toBe(50);
  });

  it('대상 효과가 없거나 null이면 0을 반환한다', () => {
    const skill4 = createSkillRes('4', [{ skill_effect: null }]);
    const skill5 = createSkillRes('5', []);

    expect(getMapleWarrior(skill4)).toBe(0);
    expect(getCriticalReinforce(skill5)).toBe(0);
  });
});
