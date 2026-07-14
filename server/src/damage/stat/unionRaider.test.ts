import { describe, expect, it } from 'vitest';
import type { UnionRaiderRes } from '../../nexon/index.js';
import { getUnionRaider } from './unionRaider.js';

describe('getUnionRaider', () => {
  it('공격대원 효과의 깡스탯을 퍼센트 미적용 버킷으로 변환한다', () => {
    const union = {
      union_raider_stat: [
        'STR 100 증가',
        'STR, DEX, LUK 50 증가',
        'ALLSTAT 40, 최대 HP 2000 증가',
        '최대 HP 6% 증가',
        '공격력/마력 25 증가',
      ],
    } as UnionRaiderRes;

    expect(getUnionRaider(union)).toEqual({
      STR미적용: 150,
      DEX미적용: 50,
      LUK미적용: 50,
      올스탯미적용: 40,
      HP미적용: 2000,
      HP퍼: 6,
      공격력: 25,
      마력: 25,
    });
  });
});
