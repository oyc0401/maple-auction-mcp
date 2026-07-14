import { describe, expect, it } from 'vitest';
import type { UnionRaiderRes } from '../../nexon/index.js';
import { getUnionState } from './unionState.js';

const res = (union_state_stat: string[]) =>
  ({ union_state_stat }) as unknown as UnionRaiderRes;

describe('유니온 점령(union_state) → StatBlock', () => {
  it('주스탯은 %적용(일반 버킷), 딜 스탯 수집, 무관 라인 무시', () => {
    // 렌 실측 union_state_stat
    const block = getUnionState(
      res([
        'STR 75 증가',
        '크리티컬 데미지 20.00% 증가',
        '공격력 15 증가',
        '보스 몬스터 공격 시 데미지 40% 증가',
        '크리티컬 확률 11% 증가',
        '버프 지속시간 28% 증가', // 무시
        '방어율 무시 40% 증가',
      ])
    );
    expect(block).toEqual({
      STR: 75,
      크뎀: 20,
      공격력: 15,
      보공: 40,
      크확: 11,
      방무: [40],
    });
  });
});
