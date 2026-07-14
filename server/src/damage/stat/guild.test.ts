import { describe, expect, it } from 'vitest';
import type { GuildBasicRes, GuildSkill } from '../../nexon/index.js';
import { getGuild } from './guild.js';

const skill = (skill_name: string, skill_effect: string): GuildSkill => ({
  skill_name,
  skill_effect,
  skill_level: 0,
  skill_description: '',
  skill_icon: '',
});

describe('길드 스킬 → StatBlock', () => {
  it('상시 노하우만 %적용 수집, 버프·일반몹·비딜 라인은 제외', () => {
    // 티엘 실측 guild_skill/noblesse
    const guild = {
      guild_skill: [
        skill('길드의 노하우Ⅰ', '공격력 30, 마력 30 증가\n받는 피해 10% 감소'),
        skill(
          '길드의 노하우Ⅴ',
          '힘 40, 민첩 40, 지력 40, 운 40, 체력 2000 증가'
        ),
        skill('길드의 노하우Ⅲ', '일반 몬스터 공격 시 데미지 12% 증가'), // 일반몹 → 제외
        skill('장사꾼', '상점에서 물건 구매 시 4% 싸게 구매 가능'), // 비딜 → 제외
      ],
      guild_noblesse_skill: [
        skill(
          '보스 킬링 머신',
          '30분 동안 보스 몬스터 공격 시 데미지 30% 증가, 재사용 대기시간 5분'
        ), // 버프 → 제외
      ],
    } as unknown as GuildBasicRes;

    expect(getGuild(guild)).toEqual({
      공격력: 30,
      마력: 30,
      STR: 40,
      DEX: 40,
      INT: 40,
      LUK: 40,
    });
  });

  it('길드 없음이면 빈 객체', () => {
    expect(getGuild(null)).toEqual({});
  });
});
