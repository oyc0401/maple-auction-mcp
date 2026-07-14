import { describe, expect, it } from 'vitest';
import type { UnionChampionRes } from '../../nexon/index.js';
import { getChampion } from './champion.js';

// 실측: .nexon-raw-티엘.json champion_badge_total_info.
describe('유니온 챔피언 뱃지 → StatBlock', () => {
  it('뱃지 합산 효과를 템플릿으로 파싱한다(올스탯·공마는 %적용, 최대 HP/MP는 미수집)', () => {
    const champion = {
      champion_badge_total_info: [
        { stat: '올스탯 100, 최대 HP/MP 5000 증가' },
        { stat: '공격력/마력 50 증가' },
        { stat: '보스 몬스터 공격 시 데미지 25% 증가' },
        { stat: '크리티컬 데미지 15.00% 증가' },
        { stat: '방어율 무시 25% 증가' },
      ],
    } as UnionChampionRes;
    expect(getChampion(champion)).toEqual({
      올스탯: 100,
      공격력: 50,
      마력: 50,
      보공: 25,
      크뎀: 15,
      방무: [25],
    });
  });

  it('챔피언이 없으면 빈 블록', () => {
    expect(
      getChampion({
        champion_badge_total_info: [],
      } as unknown as UnionChampionRes)
    ).toEqual({});
  });
});
