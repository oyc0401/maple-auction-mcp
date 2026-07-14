import { describe, expect, it } from 'vitest';
import type { UnionArtifactRes } from '../../nexon/index.js';
import { getArtifact } from './artifact.js';

function res(names: string[]): UnionArtifactRes {
  return {
    union_artifact_effect: names.map((name) => ({ name, level: 10 })),
  } as unknown as UnionArtifactRes;
}

describe('아티팩트 → StatBlock', () => {
  it('실측 크리스탈 효과에서 딜 스탯만 뽑는다', () => {
    // 티엘 실측 union_artifact_effect
    const block = getArtifact(
      res([
        '올스탯 150 증가',
        '공격력 30, 마력 30 증가',
        '데미지 15.00% 증가',
        '보스 몬스터 공격 시 데미지 15.00% 증가',
        '몬스터 방어율 무시 20% 증가',
        '버프 지속시간 20% 증가', // 무시
        '메소 획득량 12% 증가', // 무시
        '크리티컬 확률 20% 증가',
        '크리티컬 데미지 4.00% 증가',
      ])
    );
    expect(block).toEqual({
      올스탯: 150,
      공격력: 30,
      마력: 30,
      데미지: 15,
      보공: 15,
      방무: [20],
      크확: 20,
      크뎀: 4,
    });
  });
});
