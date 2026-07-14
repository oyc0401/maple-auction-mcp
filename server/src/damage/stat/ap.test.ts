import { describe, expect, it } from 'vitest';
import type { CharacterStat, StatLine } from '../../nexon/index.js';
import { getAP } from './ap.js';

function response(
  characterClass: string,
  finalStat: StatLine[],
  remainAP = 0
): CharacterStat {
  return {
    date: null,
    character_class: characterClass,
    final_stat: finalStat,
    remain_ap: remainAP,
  };
}

describe('getAP', () => {
  it('final_stat의 AP 배분 스탯을 원형 그대로 수집한다', () => {
    const result = getAP(
      response('테스트직업', [
        { stat_name: 'AP 배분 STR', stat_value: '4' },
        { stat_name: 'AP 배분 DEX', stat_value: '1498' },
        { stat_name: 'AP 배분 INT', stat_value: '120' },
        { stat_name: 'AP 배분 LUK', stat_value: '30' },
        { stat_name: 'AP 배분 HP', stat_value: '25000' },
      ])
    );

    expect(result).toEqual({
      STR: 4,
      DEX: 1498,
      INT: 120,
      LUK: 30,
      HP: 25000,
    });
  });

  it('제논과 데몬어벤져도 별도 분기 없이 같은 규칙으로 수집한다', () => {
    const finalStat: StatLine[] = [
      { stat_name: 'AP 배분 STR', stat_value: '100' },
      { stat_name: 'AP 배분 DEX', stat_value: '200' },
      { stat_name: 'AP 배분 LUK', stat_value: '300' },
      { stat_name: 'AP 배분 HP', stat_value: '400' },
    ];

    expect(getAP(response('제논', finalStat))).toEqual({
      STR: 100,
      DEX: 200,
      LUK: 300,
      HP: 400,
    });
    expect(getAP(response('데몬어벤져', finalStat))).toEqual({
      STR: 100,
      DEX: 200,
      LUK: 300,
      HP: 400,
    });
  });

  it('AP 배분 대상이 아니거나 0·잘못된 값인 라인은 무시한다', () => {
    const result = getAP(
      response(
        '테스트직업',
        [
          { stat_name: 'AP 배분 STR', stat_value: '0' },
          { stat_name: 'AP 배분 DEX', stat_value: '' },
          { stat_name: 'AP 배분 INT', stat_value: '잘못된 값' },
          { stat_name: 'AP 배분 LUK', stat_value: 'Infinity' },
          { stat_name: 'AP 배분 MP', stat_value: '9999' },
          { stat_name: '공격력', stat_value: '16617' },
        ],
        123
      )
    );

    expect(result).toEqual({});
  });
});
