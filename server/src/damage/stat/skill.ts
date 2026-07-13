import type { SkillRes } from '../../nexon/index.js';
import type { SkillStats, StatBlock } from '../stat-interface.js';
import {
  COMMON,
  CRITICAL_REINFORCE_TEMPLATES,
  MAPLE_WARRIOR_TEMPLATES,
} from './skill-db.js';
import { parseMapleTemplates } from './template-parser.js';

export function getSkill0(skill0: SkillRes): Record<string, StatBlock> {
  const result: Record<string, StatBlock> = {};
  const rules = COMMON['0'];

  for (const skill of skill0.character_skill) {
    const templates = rules[skill.skill_name];
    if (!templates) continue;

    const { block } = parseMapleTemplates(skill.skill_effect, templates);
    if (Object.keys(block).length > 0) result[skill.skill_name] = block;
  }

  return result;
}

// 등급 간 중복과 배타 규칙을 판단해야 하므로 1차 이후 응답을 함께 변환한다.
export function getSkill(
  _skill1: SkillRes,
  _skill2: SkillRes,
  _skill3: SkillRes,
  _skill4: SkillRes,
  _hyperPassive: SkillRes,
  _hyperActive: SkillRes,
  _skill5: SkillRes
): SkillStats {
  throw new Error('TODO: getSkill');
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
