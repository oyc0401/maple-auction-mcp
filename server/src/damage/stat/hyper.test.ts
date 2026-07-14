import { describe, expect, it } from 'vitest';
import type { HyperStatLine, HyperStatRes } from '../../nexon/index.js';
import { getHyper } from './hyper.js';

// 실측 문자열은 .nexon-raw-{티엘,오유찬,꽈숩노}.json 하이퍼 활성 프리셋에서 발췌.
function hyperRes(
  usePreset: string,
  lines: Array<[string, string]>
): HyperStatRes {
  const preset: HyperStatLine[] = lines.map(([stat_type, stat_increase]) => ({
    stat_type,
    stat_point: 0,
    stat_level: 1,
    stat_increase,
  }));
  const empty: HyperStatLine[] = [];
  return {
    use_preset_no: usePreset,
    hyper_stat_preset_1: usePreset === '1' ? preset : empty,
    hyper_stat_preset_2: usePreset === '2' ? preset : empty,
    hyper_stat_preset_3: usePreset === '3' ? preset : empty,
  } as unknown as HyperStatRes;
}

describe('하이퍼스탯 → StatBlock', () => {
  it('활성 프리셋의 stat_increase를 템플릿으로 파싱하고 주스탯은 미적용', () => {
    const hyper = hyperRes('1', [
      ['LUK', '운 180 증가'],
      ['공격력/마력', '공격력과 마력 21 증가'],
      ['크리티컬 확률', '크리티컬 확률 4% 증가'],
      ['크리티컬 데미지', '크리티컬 데미지 10% 증가'],
      ['방어율 무시', '방어율 무시 30% 증가'],
      ['데미지', '데미지 36% 증가'],
      [
        '보스 몬스터 공격 시 데미지 증가',
        '보스 몬스터 공격 시 데미지 51% 증가',
      ],
    ]);
    expect(getHyper(hyper)).toEqual({
      LUK미적용: 180,
      공격력: 21,
      마력: 21,
      크확: 4,
      크뎀: 10,
      방무: [30],
      데미지: 36,
      보공: 51,
    });
  });

  it('룰 없는 stat_type(획득 경험치·일반 몬스터·상태 이상 내성)은 조용히 스킵한다', () => {
    const hyper = hyperRes('2', [
      ['STR', '힘 30 증가'],
      ['획득 경험치', '획득 경험치 10.0% 증가'],
      [
        '일반 몬스터 공격 시 데미지 증가',
        '일반 몬스터 공격 시 데미지 47% 증가',
      ],
      ['상태 이상 내성', '상태 이상 내성 2 증가'],
    ]);
    expect(getHyper(hyper)).toEqual({ STR미적용: 30 });
  });

  it('use_preset_no가 가리키는 프리셋만 읽는다', () => {
    const hyper = hyperRes('3', [['DEX', '민첩성 120 증가']]);
    expect(getHyper(hyper)).toEqual({ DEX미적용: 120 });
  });
});
