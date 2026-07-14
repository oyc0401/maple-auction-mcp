import { describe, expect, it } from 'vitest';
import type { UnionArtifactRes } from '../../nexon/index.js';
import { getArtifact } from './artifact.js';

describe('getArtifact', () => {
  it('활성 아티팩트 효과 이름을 StatBlock으로 변환한다', () => {
    const artifact = {
      union_artifact_effect: [
        { name: '올스탯 150 증가' },
        { name: '공격력 30, 마력 30 증가' },
        { name: '몬스터 방어율 무시 20% 증가' },
      ],
    } as UnionArtifactRes;

    expect(getArtifact(artifact)).toEqual({
      올스탯: 150,
      공격력: 30,
      마력: 30,
      방무: [20],
    });
  });
});
