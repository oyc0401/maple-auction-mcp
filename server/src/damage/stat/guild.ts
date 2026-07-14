import type { GuildBasicRes } from '../../nexon/index.js';
import type { StatBlock } from '../stat-interface.js';
import { GUILD } from './guild-db.js';
import { parseEffectLines } from './template-parser.js';

// 길드 스킬 → StatBlock. 정규 길드스킬 + 노블레스 스킬 중 상시 패시브만 반영.
// 버프도 다 반영
export function getGuild(guild: GuildBasicRes | null): StatBlock {
  if (!guild) return {};
  const skills = [
    ...(guild.guild_skill ?? []),
    ...(guild.guild_noblesse_skill ?? []),
  ];
  const lines: string[] = [];
  for (const skill of skills) {
    const effect = String(skill.skill_effect ?? '');
    lines.push(...effect.split('\n'));
  }
  return parseEffectLines(lines, GUILD);
}
