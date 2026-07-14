import { describe, expect, it } from 'vitest';
import type { AbilityRes } from '../../nexon/index.js';
import { getAbility } from './ability.js';

function res(values: string[]): AbilityRes {
  return {
    ability_info: values.map((ability_value, i) => ({
      ability_no: String(i + 1),
      ability_grade: '',
      ability_value,
    })),
  } as unknown as AbilityRes;
}

describe('어빌리티 → StatBlock', () => {
  it('실측 ability_value에서 딜 스탯만 뽑고 조건부/무관은 무시', () => {
    // 오유찬 실측
    const block = getAbility(
      res([
        '스킬 사용 시 20% 확률로 재사용 대기시간이 미적용', // 무시
        '상태 이상에 걸린 대상 공격 시 데미지 8% 증가',
        '크리티컬 확률 8% 증가',
      ])
    );
    expect(block).toEqual({ 추가뎀: 8, 크확: 8 });
  });

  it('콤마 독립절(주스탯 2개)을 분해한다', () => {
    expect(getAbility(res(['INT 40 증가, STR 40 증가']))).toEqual({
      INT: 40,
      STR: 40,
    });
  });
});
