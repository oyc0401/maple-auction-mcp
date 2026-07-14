import { describe, expect, it } from 'vitest';
import type { HexaMatrixStatRes, HexaStatCore } from '../../nexon/index.js';
import { getHexaStat } from './hexaStat.js';

function core(
  main: [string, number],
  s1: [string, number],
  s2: [string, number]
): HexaStatCore {
  return {
    slot_id: '0',
    main_stat_name: main[0],
    main_stat_level: main[1],
    sub_stat_name_1: s1[0],
    sub_stat_level_1: s1[1],
    sub_stat_name_2: s2[0],
    sub_stat_level_2: s2[1],
    stat_grade: 20,
  };
}

function res(
  character_class: string,
  cores: HexaStatCore[]
): HexaMatrixStatRes {
  return {
    character_class,
    character_hexa_stat_core: cores,
  } as unknown as HexaMatrixStatRes;
}

describe('헥사 스탯 → StatBlock', () => {
  it('일반 직업: 주력스탯은 미적용, 공/마는 이름으로 갈라, 보스/방무 수집', () => {
    // 나이트로드(LUK). main lv7=1000, 보스 lv3=3, 공격력 lv10=50
    const block = getHexaStat(
      res('나이트로드', [
        core(
          ['주력 스탯 증가', 7],
          ['보스 데미지 증가', 3],
          ['공격력 증가', 10]
        ),
      ])
    );
    expect(block).toEqual({ LUK미적용: 1000, 보공: 3, 공격력: 50 });
  });

  it('제논: 주력스탯 = 4스탯 미적용(제논 수치표)', () => {
    const block = getHexaStat(
      res('제논', [
        core(['주력 스탯 증가', 10], ['마력 증가', 5], ['방어율 무시 증가', 4]),
      ])
    );
    // main lv10=960(각 스탯), 마력 lv5=SUB.atk[4]=25, 방무 lv4=SUB.ied[3]=4
    expect(block).toEqual({
      STR미적용: 960,
      DEX미적용: 960,
      INT미적용: 960,
      LUK미적용: 960,
      마력: 25,
      방무: [4],
    });
  });

  it('데몬어벤져: 주력스탯 = MAX HP 미적용', () => {
    const block = getHexaStat(
      res('데몬어벤져', [
        core(
          ['주력 스탯 증가', 10],
          ['크리티컬 데미지 증가', 10],
          ['데미지 증가', 10]
        ),
      ])
    );
    // main lv10=42000, 크뎀 lv10=3.5, 데미지 lv10=7.5
    expect(block).toEqual({ HP미적용: 42000, 크뎀: 3.5, 데미지: 7.5 });
  });

  it('JOB_STAT 미등재 직업: 주력스탯만 스킵하고 나머지는 수집', () => {
    const block = getHexaStat(
      res('없는직업', [
        core(
          ['주력 스탯 증가', 10],
          ['보스 데미지 증가', 10],
          ['크리티컬 데미지 증가', 10]
        ),
      ])
    );
    expect(block).toEqual({ 보공: 10, 크뎀: 3.5 });
  });
});
