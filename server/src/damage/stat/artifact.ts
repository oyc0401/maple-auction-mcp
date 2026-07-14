import type { UnionArtifactRes } from '../../nexon/index.js';
import type { StatBlock } from '../stat-interface.js';
import { ARTIFACT } from './artifact-db.js';
import { parseEffectLines } from './template-parser.js';

// 유니온 아티팩트 → StatBlock. 크리스탈 효과는 상시. name 문자열에 최종 수치가 박혀 있어 그대로 파싱.
export function getArtifact(artifact: UnionArtifactRes): StatBlock {
  const lines = (artifact.union_artifact_effect ?? []).map((e) => e.name);
  return parseEffectLines(lines, ARTIFACT);
}
