import { describe, expect, it } from 'vitest';
import type { SetEffectRes } from '../../nexon/index.js';
import { getSet } from './set.js';

describe('getSet', () => {
  it('set_effect_info에 포함된 현재 적용 세트 효과만 합산한다', () => {
    const response: SetEffectRes = {
      date: null,
      set_effect: [
        {
          set_name: '광휘의 보스 세트',
          total_set_count: 3,
          set_effect_info: [
            {
              set_count: 2,
              set_option:
                '올스탯  +20, 최대 HP  +500, 공격력  +20, 마력  +20, 보스 몬스터 데미지 +15%',
            },
            {
              set_count: 3,
              set_option:
                '올스탯  +20, 최대 HP  +500, 공격력  +20, 마력  +20, 몬스터 방어율 무시 : +15%',
            },
          ],
          set_option_full: [
            {
              set_count: 2,
              set_option:
                '올스탯  +20, 최대 HP  +500, 공격력  +20, 마력  +20, 보스 몬스터 데미지 +15%',
            },
            {
              set_count: 3,
              set_option:
                '올스탯  +20, 최대 HP  +500, 공격력  +20, 마력  +20, 몬스터 방어율 무시 : +15%',
            },
            {
              set_count: 4,
              set_option:
                '올스탯  +20, 최대 HP  +500, 공격력  +20, 마력  +20, 크리티컬 데미지 +5%',
            },
          ],
        },
      ],
    };

    expect(getSet(response)).toEqual({
      '광휘의 보스 세트': {
        올스탯: 40,
        HP: 1000,
        공격력: 40,
        마력: 40,
        보공: 15,
        방무: [15],
      },
    });
  });

  it('스탯이 없는 세트 스킬 문구는 결과에서 제외한다', () => {
    const response: SetEffectRes = {
      date: null,
      set_effect: [
        {
          set_name: '쁘띠 포니 세트',
          total_set_count: 3,
          set_effect_info: [
            {
              set_count: 3,
              set_option: '[포니 파워 Lv.3] 스킬 사용 가능',
            },
          ],
          set_option_full: [],
        },
      ],
    };

    expect(getSet(response)).toEqual({});
  });
});
