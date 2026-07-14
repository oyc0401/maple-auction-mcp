import type { SkillRes } from '../../nexon/index.js';
import type { SkillStats, StatBlock } from '../stat-interface.js';
import {
  COMMON,
  CRITICAL_REINFORCE_TEMPLATES,
  JOB_RULES,
  MAPLE_WARRIOR_TEMPLATES,
} from './skill-db.js';
import { type MapleTemplate, parseMapleTemplates } from './template-parser.js';

// 한 등급 응답 → 스킬명별 StatBlock. rules = 스킬명 → 템플릿. 중복·배타는 rules에 반영돼 있음(skill-db 주석 참고).
function parseSkillGrade(
  res: SkillRes,
  rules: Record<string, MapleTemplate[]>
): Record<string, StatBlock> {
  const result: Record<string, StatBlock> = {};
  for (const skill of res.character_skill) {
    const templates = rules[skill.skill_name];
    if (!templates) continue;

    const { block } = parseMapleTemplates(skill.skill_effect, templates);
    if (Object.keys(block).length > 0) result[skill.skill_name] = block;
  }
  return result;
}

export function getSkill0(skill0: SkillRes): Record<string, StatBlock> {
  return parseSkillGrade(skill0, COMMON['0']);
}

// 일반 스킬 패시브. 직업(character_class)의 등급별 룰로 각 응답을 변환한다.
export function getSkill(
  skill1: SkillRes,
  skill2: SkillRes,
  skill3: SkillRes,
  skill4: SkillRes,
  hyperPassive: SkillRes,
  hyperActive: SkillRes,
  skill5: SkillRes
): SkillStats {
  const rules = JOB_RULES[skill1.character_class] ?? {};
  const grade = (res: SkillRes, key: string) =>
    parseSkillGrade(res, rules[key] ?? {});
  return {
    스킬_1차: grade(skill1, '1'),
    스킬_2차: grade(skill2, '2'),
    스킬_3차: grade(skill3, '3'),
    스킬_4차: grade(skill4, '4'),
    스킬_하이퍼_패시브: grade(hyperPassive, 'hyperpassive'),
    스킬_하이퍼_액티브: grade(hyperActive, 'hyperactive'),
    스킬_5차: grade(skill5, '5'),
  };
}

// 메이플 용사
export function getMapleWarrior(skill4: SkillRes): number {
  for (const skill of skill4.character_skill) {
    const templates = MAPLE_WARRIOR_TEMPLATES[skill.skill_name];
    if (!templates) continue;

    const { block } = parseMapleTemplates(skill.skill_effect, templates);
    if (block.올스탯퍼 !== undefined) return block.올스탯퍼;
  }

  return 0;
}

// 크리인 수치
export function getCriticalReinforce(skill5: SkillRes): number {
  for (const skill of skill5.character_skill) {
    const templates = CRITICAL_REINFORCE_TEMPLATES[skill.skill_name];
    if (!templates) continue;

    const { block } = parseMapleTemplates(skill.skill_effect, templates);
    if (block.크뎀 !== undefined) return block.크뎀;
  }

  return 0;
}
