import { describe, expect, it } from 'vitest';
import { normalizeMapleTemplate, parseMapleTemplates } from './template-parser.js';

describe('MapleTemplate 파서', () => {
  it('문자열 축약형을 mul 1로 정규화한다', () => {
    expect(normalizeMapleTemplate('공격력 ${공격력} 증가')).toEqual({
      template: '공격력 ${공격력} 증가',
      mul: 1,
    });
  });

  it('placeholder가 선언한 flat과 percent 스탯을 구분한다', () => {
    const result = parseMapleTemplates(
      '공격력 1,234 증가, 공격력 12.5% 증가',
      ['공격력 ${공격력} 증가', '공격력 ${공격력퍼}% 증가']
    );

    expect(result).toEqual({
      block: { 공격력: 1234, 공격력퍼: 12.5 },
      unmatchedTemplates: [],
    });
  });

  it('공/마 placeholder를 두 스탯에 동일하게 적용한다', () => {
    expect(parseMapleTemplates('공격력과 마력 30 증가', [
      '공격력과 마력 ${공/마} 증가',
    ]).block).toEqual({ 공격력: 30, 마력: 30 });
  });

  it('mul만큼 가산 스탯은 더하고 방무와 최종뎀은 각각 중첩한다', () => {
    const result = parseMapleTemplates(
      '공격력 3, 방어율 무시 4%, 최종 데미지 5% 증가',
      [{
        template: '공격력 ${공격력}, 방어율 무시 ${방무}%, 최종 데미지 ${최종뎀}% 증가',
        mul: 2,
      }]
    );

    expect(result.block).toEqual({
      공격력: 6,
      방무: [4, 4],
      최종뎀: [5, 5],
    });
  });

  it('일치하지 않은 템플릿을 진단 정보로 반환한다', () => {
    expect(parseMapleTemplates('공격력 10 증가', [
      '마력 ${마력} 증가',
    ])).toEqual({
      block: {},
      unmatchedTemplates: ['마력 ${마력} 증가'],
    });
  });

  it('알 수 없는 placeholder와 잘못된 mul을 거부한다', () => {
    expect(() => parseMapleTemplates('값 1', ['값 ${없는키}'])).toThrow('없는키');
    expect(() => parseMapleTemplates('공격력 1 증가', [{
      template: '공격력 ${공격력} 증가',
      mul: 0,
    }])).toThrow('1 이상의 정수');
  });
});
