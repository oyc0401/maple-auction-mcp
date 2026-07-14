import { describe, expect, it } from 'vitest';
import type { LinkSkillRes, SkillEntry } from '../../nexon/index.js';
import { getLink } from './link.js';

const entry = (skill_name: string, skill_effect: string): SkillEntry => ({
  skill_name,
  skill_effect,
  skill_level: 0,
  skill_description: '',
  skill_icon: '',
});

describe('링크스킬 → 스킬명별 StatBlock', () => {
  it('활성 링크 + 보유 링크(직업 접미 제거)를 변환한다', () => {
    // 티엘 실측
    const link = {
      character_link_skill: [
        entry('판단', ' 크리티컬 데미지 6% 증가'),
        entry(
          '시그너스 블레스',
          '공격력과 마력 25, 상태 이상 내성 15, 모든 속성 내성 15% 증가'
        ),
        entry('자연의 벗', '데미지 5% 증가\n일반 몬스터 20명 처치 시 …'),
        entry('엘프의 축복', '사용 시 에우렐로 귀환'), // 룰 없음 → 제외
      ],
      character_owned_link_skill: entry(
        '어드벤쳐러 큐리어스(보우마스터)',
        '몬스터 컬렉션 등록 확률 35%, 크리티컬 확률 10% 증가'
      ),
    } as unknown as LinkSkillRes;

    expect(getLink(link)).toEqual({
      판단: { 크뎀: 6 },
      '시그너스 블레스': { 공격력: 25, 마력: 25 },
      '자연의 벗': { 데미지: 5 },
      '어드벤쳐러 큐리어스': { 크확: 10 },
    });
  });
});
