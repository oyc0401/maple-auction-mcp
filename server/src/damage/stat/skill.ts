import type { SkillRes } from '../../nexon/index.js';
import type { SkillStats, StatBlock } from '../stat-interface.js';

export function getSkill0(_skill: SkillRes): Record<string, StatBlock> {
  throw new Error('TODO: getSkill0');
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
