import { describe, expect, it } from 'vitest';
import type { UnionRaiderRes } from '../../nexon/index.js';
import { getUnionState } from './unionState.js';

describe('getUnionState', () => {
  it('점령 효과와 전투대 배치 효과를 함께 변환한다', () => {
    const union = {
      union_state_stat: ['STR 75 증가', '크리티컬 데미지 20.00% 증가'],
      union_occupied_stat: [
        '보스 몬스터 공격 시 데미지 40% 증가',
        '방어율 무시 40% 증가',
      ],
    } as unknown as UnionRaiderRes;

    expect(getUnionState(union)).toEqual({
      STR: 75,
      크뎀: 20,
      보공: 40,
      방무: [40],
    });
  });
});
