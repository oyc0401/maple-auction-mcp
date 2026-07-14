import { describe, expect, it } from 'vitest';
import { parseEffectLines } from './effect-lines-parser.js';

describe('parseEffectLines', () => {
  it('여러 줄에서 파싱한 스칼라 스탯은 합산하고 배열 스탯은 순서대로 누적한다', () => {
    const result = parseEffectLines(
      [
        '공격력 10 증가',
        '공격력 5 증가',
        '몬스터 방어율 무시 30% 증가',
        '몬스터 방어율 무시 20% 증가',
      ]
    );

    expect(result).toEqual({
      공격력: 15,
      방무: [30, 20],
    });
  });

  it('한 줄에 여러 스탯이 들어 있어도 모두 파싱한다', () => {
    const result = parseEffectLines(
      ['공격력 30, 마력 30 증가', '올스탯 150 증가']
    );

    expect(result).toEqual({
      공격력: 30,
      마력: 30,
      올스탯: 150,
    });
  });

  it('어떤 템플릿과도 일치하지 않는 줄은 무시한다', () => {
    const result = parseEffectLines(
      ['공격력 10 증가', '버프 지속시간 20% 증가']
    );

    expect(result).toEqual({ 공격력: 10 });
  });

  it('보공·상태이상 대상 데미지·일반 데미지를 서로 다른 스탯으로 구분한다', () => {
    const result = parseEffectLines([
      '보스 몬스터 공격 시 데미지 20% 증가',
      '상태 이상에 걸린 대상 공격 시 데미지 8% 증가',
      '데미지 10% 증가',
    ]);

    expect(result).toEqual({
      보공: 20,
      추가뎀: 8,
      데미지: 10,
    });
  });

  it('콤마로 연결된 독립적인 어빌리티 스탯을 각각 파싱한다', () => {
    const result = parseEffectLines([
      'INT 40 증가, STR 40 증가',
      'DEX 20 증가, LUK 30 증가',
    ]);

    expect(result).toEqual({
      STR: 40,
      DEX: 20,
      INT: 40,
      LUK: 30,
    });
  });

  it('소수점이 포함된 퍼센트 스탯을 보존한다', () => {
    const result = parseEffectLines([
      '크리티컬 확률 8.5% 증가',
      '데미지 12.25% 증가',
    ]);

    expect(result).toEqual({
      크확: 8.5,
      데미지: 12.25,
    });
  });

  it('숫자가 있어도 딜 StatBlock 대상이 아닌 어빌리티 옵션은 무시한다', () => {
    const result = parseEffectLines([
      '스킬 사용 시 20% 확률로 재사용 대기시간이 미적용',
      '패시브 스킬 레벨 1 증가',
      '버프 스킬의 지속 시간 50% 증가',
      '공격 속도 1단계 증가',
      '아이템 드롭률 20% 증가',
    ]);

    expect(result).toEqual({});
  });

  it('유니온 점령에서 제공하는 스탯 라인을 파싱한다', () => {
    const result = parseEffectLines([
      'STR 75 증가',
      '크리티컬 데미지 20.00% 증가',
      '공격력 15 증가',
      '보스 몬스터 공격 시 데미지 40% 증가',
      '크리티컬 확률 11% 증가',
      '방어율 무시 40% 증가',
    ]);

    expect(result).toEqual({
      STR: 75,
      크뎀: 20,
      공격력: 15,
      보공: 40,
      크확: 11,
      방무: [40],
    });
  });

  it('유니온 공격대원의 공유값·ALLSTAT·공마·HP 복합 라인을 파싱한다', () => {
    const result = parseEffectLines([
      'STR, DEX, LUK 50 증가',
      'ALLSTAT 40, 최대 HP 2000 증가',
      '최대 HP 6% 증가',
      '공격력/마력 25 증가',
    ]);

    expect(result).toEqual({
      STR: 50,
      DEX: 50,
      LUK: 50,
      올스탯: 40,
      HP: 2000,
      HP퍼: 6,
      공격력: 25,
      마력: 25,
    });
  });

  it('유니온 아티팩트에서 제공하는 복합·소수점 스탯 라인을 파싱한다', () => {
    const result = parseEffectLines([
      '올스탯 150 증가',
      '공격력 30, 마력 30 증가',
      '데미지 15.00% 증가',
      '보스 몬스터 공격 시 데미지 15.00% 증가',
      '몬스터 방어율 무시 20% 증가',
      '크리티컬 확률 20% 증가',
      '크리티컬 데미지 4.00% 증가',
    ]);

    expect(result).toEqual({
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
