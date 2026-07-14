import { describe, expect, it } from 'vitest';
import type { AbilityRes } from '../../nexon/index.js';
import { getAbility } from './ability.js';

describe('getAbility', () => {
  it('활성 어빌리티 라인을 StatBlock으로 변환한다', () => {
    const ability = {
      ability_info: [
        { ability_value: '스킬 사용 시 20% 확률로 재사용 대기시간이 미적용' },
        { ability_value: '상태 이상에 걸린 대상 공격 시 데미지 8% 증가' },
        { ability_value: '크리티컬 확률 8% 증가' },
      ],
    } as AbilityRes;

    expect(getAbility(ability)).toEqual({ 추가뎀: 8, 크확: 8 });
  });
});
