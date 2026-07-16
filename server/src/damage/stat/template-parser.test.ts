import { describe, expect, it } from 'vitest';
import { parseMapleTemplates } from './template-parser.js';

// 공개 파싱 함수는 parseMapleTemplates 하나뿐이다.

describe('parseMapleTemplates — 한 문자열에 모든 템플릿 fire 후 누산', () => {
  it('placeholder가 선언한 flat과 percent 스탯을 구분한다', () => {
    const result = parseMapleTemplates('공격력 1,234 증가, 공격력 12.5% 증가', [
      '공격력 ${공격력} 증가',
      '공격력 ${공격력퍼}% 증가',
    ]);

    expect(result).toEqual({
      block: { 공격력: 1234, 공격력퍼: 12.5 },
    });
  });

  it('공/마 placeholder를 두 스탯에 동일하게 적용한다', () => {
    expect(
      parseMapleTemplates('무슨무슨 스킬이고 공격력을 35 증가시킬 것 같지만 구라고 사실은 공격력과 마력 30 증가한다.', [
        '공격력과 마력 ${공/마} 증가',
      ]).block
    ).toEqual({ 공격력: 30, 마력: 30 });
  });

  it('mul만큼 가산 스탯은 더하고 방무와 최종뎀은 각각 중첩한다', () => {
    const result = parseMapleTemplates(
      '공격력 3, 방어율 무시 4%, 최종 데미지 5% 증가',
      [
        {
          template:
            '공격력 ${공격력}, 방어율 무시 ${방무}%, 최종 데미지 ${최종뎀}% 증가',
          mul: 2,
        },
      ]
    );

    expect(result.block).toEqual({
      공격력: 6,
      방무: [4, 4],
      최종뎀: [5, 5],
    });
  });

  it('일치하지 않은 템플릿은 무시한다', () => {
    expect(
      parseMapleTemplates('공격력 10 증가', ['마력 ${마력} 증가'])
    ).toEqual({
      block: {},
    });
  });

  it('알 수 없는 placeholder를 거부한다', () => {
    expect(() => parseMapleTemplates('값 1', ['값 ${없는키}'])).toThrow(
      '없는키'
    );
  });

  it('mul이 0이면 템플릿을 적용하지 않는다', () => {
    expect(
      parseMapleTemplates('공격력 1 증가', [
        {
          template: '공격력 ${공격력} 증가',
          mul: 0,
        },
      ])
    ).toEqual({ block: {} });
  });

  it('소수 mul은 추출한 수치에 배수를 곱한다', () => {
    expect(
      parseMapleTemplates('30초 동안 데미지 60% 증가', [
        {
          template: '데미지 ${데미지}% 증가',
          mul: 0.25,
        },
      ])
    ).toEqual({ block: { 데미지: 15 } });
  });

  it('정수부는 중첩하고 소수부는 남은 배수만큼 적용한다', () => {
    expect(
      parseMapleTemplates('중첩당 최종 데미지 10% 증가', [
        {
          template: '중첩당 최종 데미지 ${최종뎀}% 증가',
          mul: 1.5,
        },
      ])
    ).toEqual({ block: { 최종뎀: [10, 5] } });
  });
});
