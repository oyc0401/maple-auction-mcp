import type { UnionArtifactRes } from '../../nexon/index.js';
import type { StatBlock } from '../stat-interface.js';
import { parseEffectLines } from './effect-lines-parser.js';

export function getArtifact(artifact: UnionArtifactRes): StatBlock {
  return parseEffectLines(
    (artifact.union_artifact_effect ?? []).map((effect) => effect.name)
  );
}
