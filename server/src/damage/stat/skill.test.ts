import { describe, expect, it } from 'vitest';
import type { SkillEntry, SkillGrade, SkillRes } from '../../nexon/index.js';
import {
  getCriticalReinforce,
  getMapleWarrior,
  getSkill,
  getSkill0,
} from './skill.js';

function createSkillRes(
  grade: SkillGrade,
  skills: Array<Partial<SkillEntry>>
): SkillRes {
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
    const skill4 = createSkillRes('4', [
      {
        skill_name: skillName,
        skill_effect: `[패시브 효과 : AP를 직접 투자한 모든 능력치 ${expected}% 증가]`,
      },
    ]);

    expect(getMapleWarrior(skill4)).toBe(expected);
  });

  it('다른 AP 증가 스킬은 메이플 용사로 오인하지 않는다', () => {
    const skill4 = createSkillRes('4', [
      {
        skill_name: '파이렛 플래그',
        skill_effect: '파티원의 AP를 직접 투자한 모든 능력치 25% 증가',
      },
    ]);

    expect(getMapleWarrior(skill4)).toBe(0);
  });

  it('크리티컬 리인포스의 크확 대비 크뎀 비율을 추출한다', () => {
    const skill5 = createSkillRes('5', [
      {
        skill_name: '크리티컬 리인포스',
        skill_effect: '크리티컬 확률의 50% 만큼 크리티컬 데미지 증가',
      },
    ]);

    expect(getCriticalReinforce(skill5)).toBe(50);
  });

  it('대상 효과가 없거나 null이면 0을 반환한다', () => {
    const skill4 = createSkillRes('4', [{ skill_effect: null }]);
    const skill5 = createSkillRes('5', []);

    expect(getMapleWarrior(skill4)).toBe(0);
    expect(getCriticalReinforce(skill5)).toBe(0);
  });
});

describe('0차 스킬 수치 변환', () => {
  it('등록된 0차 스킬을 스킬별 StatBlock으로 변환한다', () => {
    const skill0 = createSkillRes('0', [
      {
        skill_name: '연합의 의지',
        skill_effect: '힘 5, 민첩 5, 지능 5, 행운 5, 공격력 5, 마력 5 증가',
      },
      {
        skill_name: '훈련 일지',
        skill_effect: [
          '공격력/마력 15 증가',
          '보스 몬스터 공격 시 데미지 40% 증가',
          '몬스터 방어율 무시 20% 증가',
          '올스탯 30 증가',
          '크리티컬 확률 10% 증가',
        ].join('\n'),
      },
    ]);

    expect(getSkill0(skill0)).toEqual({
      '연합의 의지': {
        STR: 5,
        DEX: 5,
        INT: 5,
        LUK: 5,
        공격력: 5,
        마력: 5,
      },
      '훈련 일지': {
        공격력: 15,
        마력: 15,
        보공: 40,
        방무: [20],
        올스탯: 30,
        크확: 10,
      },
    });
  });

  it('등록되지 않았거나 효과가 매칭되지 않는 스킬은 제외한다', () => {
    const skill0 = createSkillRes('0', [
      { skill_name: '달팽이 세마리', skill_effect: '달팽이 껍질을 던진다' },
      { skill_name: '여제의 축복', skill_effect: null },
    ]);

    expect(getSkill0(skill0)).toEqual({});
  });
});

describe('일반 스킬(getSkill) 등급별 변환', () => {
  const empty = createSkillRes('0', []);

  it('직업(character_class) 등급별 룰로 각 차수를 변환한다', () => {
    // 카데나: 1차 콜렉팅 포리프(LUK), 2차 피지컬 트레이닝(LUK·DEX)
    const skill1 = {
      ...createSkillRes('1', [
        { skill_name: '콜렉팅 포리프', skill_effect: '행운 60 증가' },
      ]),
      character_class: '카데나',
    };
    const skill2 = createSkillRes('2', [
      {
        skill_name: '피지컬 트레이닝',
        skill_effect: '행운 100, 민첩성 50 증가',
      },
      { skill_name: '모르는 스킬', skill_effect: '뭔가 함' }, // 룰 없음 → 제외
    ]);

    const result = getSkill(skill1, skill2, empty, empty, empty, empty, empty);
    expect(result.스킬_1차).toEqual({ '콜렉팅 포리프': { LUK: 60 } });
    expect(result.스킬_2차).toEqual({
      '피지컬 트레이닝': { LUK: 100, DEX: 50 },
    });
    expect(result.스킬_3차).toEqual({});
    expect(result.스킬_5차).toEqual({});
  });

  it('JOB_RULES 미등재 직업은 전부 빈 객체', () => {
    const skill1 = {
      ...createSkillRes('1', [
        { skill_name: '콜렉팅 포리프', skill_effect: '행운 60 증가' },
      ]),
      character_class: '없는직업',
    };
    const result = getSkill(skill1, empty, empty, empty, empty, empty, empty);
    expect(result.스킬_1차).toEqual({});
  });
});
