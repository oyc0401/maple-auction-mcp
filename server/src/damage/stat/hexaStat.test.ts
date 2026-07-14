import { describe, expect, it } from 'vitest';
import type { HexaMatrixStatRes, HexaStatCore } from '../../nexon/index.js';
import { getHexaStat } from './hexaStat.js';

function core(
  main: [string, number],
  sub1: [string, number],
  sub2: [string, number]
): HexaStatCore {
  return {
    slot_id: '0',
    main_stat_name: main[0],
    main_stat_level: main[1],
    sub_stat_name_1: sub1[0],
    sub_stat_level_1: sub1[1],
    sub_stat_name_2: sub2[0],
    sub_stat_level_2: sub2[1],
    stat_grade: 20,
  };
}

function response(
  characterClass: string,
  cores: HexaStatCore[]
): HexaMatrixStatRes {
  return {
    character_class: characterClass,
    character_hexa_stat_core: cores,
  } as unknown as HexaMatrixStatRes;
}

describe('getHexaStat', () => {
  it('일반 직업의 주력 스탯과 부가 스탯을 레벨 수치표로 변환한다', () => {
    const result = getHexaStat(
      response('나이트로드', [
        core(
          ['주력 스탯 증가', 7],
          ['보스 데미지 증가', 3],
          ['공격력 증가', 10]
        ),
      ])
    );

    expect(result).toEqual({ LUK미적용: 1000, 보공: 3, 공격력: 50 });
  });

  it('제논의 주력 스탯을 네 스탯 미적용 버킷에 각각 반영한다', () => {
    const result = getHexaStat(
      response('제논', [
        core(
          ['주력 스탯 증가', 10],
          ['마력 증가', 5],
          ['방어율 무시 증가', 4]
        ),
      ])
    );

    expect(result).toEqual({
      STR미적용: 960,
      DEX미적용: 960,
      INT미적용: 960,
      LUK미적용: 960,
      마력: 25,
      방무: [4],
    });
  });

  it('데몬어벤져의 주력 스탯을 HP 미적용 버킷에 반영한다', () => {
    const result = getHexaStat(
      response('데몬어벤져', [
        core(
          ['주력 스탯 증가', 10],
          ['크리티컬 데미지 증가', 10],
          ['데미지 증가', 10]
        ),
      ])
    );

    expect(result).toEqual({ HP미적용: 42000, 크뎀: 3.5, 데미지: 7.5 });
  });

  it('직업 정보가 없으면 주력 스탯만 건너뛰고 나머지는 반영한다', () => {
    const result = getHexaStat(
      response('없는직업', [
        core(
          ['주력 스탯 증가', 10],
          ['보스 데미지 증가', 10],
          ['크리티컬 데미지 증가', 10]
        ),
      ])
    );

    expect(result).toEqual({ 보공: 10, 크뎀: 3.5 });
  });
});
