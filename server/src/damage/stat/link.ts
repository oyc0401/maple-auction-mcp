import type { LinkSkillRes, SkillEntry } from '../../nexon/index.js';
import type { StatBlock } from '../stat-interface.js';
import { LINK } from './linkskill-db.js';
import { parseMapleTemplates } from './template-parser.js';

// 링크스킬 → 스킬명별 StatBlock. 활성 링크(character_link_skill) + 보유 링크(character_owned_link_skill).
// 룰 키는 직업 접미("(보우마스터)" 등)를 뗀 스킬명.
export function getLink(link: LinkSkillRes): Record<string, StatBlock> {
  const result: Record<string, StatBlock> = {};
  const owned = link.character_owned_link_skill;
  const skills: SkillEntry[] = [
    ...(link.character_link_skill ?? []),
    ...(owned ? [owned] : []),
  ];

  for (const skill of skills) {
    const name = skill.skill_name.replace(/\s*\([^)]*\)\s*$/, '');
    const templates = LINK[name];
    if (!templates) continue;

    const { block } = parseMapleTemplates(skill.skill_effect, templates);
    if (Object.keys(block).length > 0) result[name] = block;
  }
  return result;
}
