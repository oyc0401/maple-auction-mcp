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
  it('노하우(공/마·주스탯)와 노블레스 버프(보공·방무·데미지·크뎀)를 스킬명별로 누산', () => {
    // 티엘 실측 guild_skill/noblesse 전체
    const guild = {
      guild_skill: [
        skill('장사꾼', '상점에서 물건 구매 시 4% 싸게 구매 가능'),
        skill('길드의 노하우Ⅰ', '공격력 30, 마력 30 증가\r\n받는 피해 10% 감소'),
        skill('길드의 노하우Ⅱ', '공격력 6, 마력 6 증가'),
        skill('길드의 노하우Ⅲ', '일반 몬스터 공격 시 데미지 12% 증가'), // 일반몹 → 미등재
        skill('길드의 노하우Ⅳ', '공격력 4, 마력 4 증가'),
        skill('길드의 노하우Ⅴ', '힘 40, 민첩 40, 지력 40, 운 40, 체력 2000 증가'),
        skill('길드의 노하우Ⅵ', '공격력 5, 마력 5 증가'),
        skill('특별한 힘', '아케인포스 30 증가\r\n스타포스 15 증가'), // 딜 무관
      ],
      guild_noblesse_skill: [
        skill('보스 킬링 머신', '30분 동안 보스 몬스터 공격 시 데미지 30% 증가, 재사용 대기시간 5분'),
        skill('방어력은 숫자일 뿐', '30분 동안 몬스터 방어율 무시 30% 증가, 재사용 대기시간 5분'),
        skill('길드의 이름으로', '30분 동안 데미지 30% 증가, 재사용 대기시간 5분'),
        skill('크게 한방', '30분 동안 크리티컬 데미지 30% 증가, 재사용 대기시간 5분'),
      ],
    } as unknown as GuildBasicRes;

    expect(getGuild(guild)).toEqual({
      공격력: 45, // 30+6+4+5
      마력: 45,
      STR: 40,
      DEX: 40,
      INT: 40,
      LUK: 40,
      보공: 30,
      방무: [30],
      데미지: 30,
      크뎀: 30,
    });
  });

  it('길드 없음이면 빈 객체', () => {
    expect(getGuild(null)).toEqual({});
  });
});
