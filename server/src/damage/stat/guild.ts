import type { GuildBasicRes } from '../../nexon/index.js';
import type { StatBlock } from '../stat-interface.js';
import { GUILD } from './guild-db.js';
import { mergeStatBlock, parseMapleTemplates } from './template-parser.js';

// 길드 스킬 → StatBlock. 정규 길드스킬 + 노블레스 버프를 스킬명별 템플릿으로 뽑아 한 블록에 누산.
export function getGuild(guild: GuildBasicRes | null): StatBlock {
  if (!guild) return {};
  const block: StatBlock = {};
  const skills = [...(guild.guild_skill ?? []), ...(guild.guild_noblesse_skill ?? [])];
  for (const skill of skills) {
    const templates = GUILD[skill.skill_name];
    if (!templates) continue;
    const { block: parsed } = parseMapleTemplates(skill.skill_effect, templates);
    mergeStatBlock(block, parsed);
  }
  return block;
}
