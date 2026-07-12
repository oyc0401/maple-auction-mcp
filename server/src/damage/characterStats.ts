// 리팩토링용 더미 — CharacterStats 조립이 지향하는 모양(파이프라인 미연결).
// 소스를 get* 함수로 하나씩 옮기면서 이 모양으로 수렴시킨다. 지금은 스킬 파트만 이관됨.
// 실제 조립은 character.ts(buildCharacterStats).
import type { CharacterStats } from './stat-interface.js';
import type { RawBundle } from './nexon.js';
import { getSkill } from './stat/skill.js';

export function getCharacterStats(bundle: RawBundle): CharacterStats {
  const job: string = bundle.stat?.character_class ?? '';

  const skill = getSkill(job, bundle.skills);

  const stat: CharacterStats = {
    기본: { 크확: 5, 크뎀: 35 },
    AP: {}, // TODO: getAP(bundle)
    메이플용사: skill.메이플용사,
    크리티컬리인포스: skill.크리티컬리인포스,
    // TODO: 장비 · 세트효과 · 심볼 · 하이퍼스탯 · 어빌리티 · 유니온 · 아티팩트 · 챔피언 · 성향 → get* 이관
    스킬_0차: skill.스킬_0차,
    스킬_1차: skill.스킬_1차,
    스킬_2차: skill.스킬_2차,
    스킬_3차: skill.스킬_3차,
    스킬_4차: skill.스킬_4차,
    스킬_하이퍼: skill.스킬_하이퍼,
    스킬_5차: skill.스킬_5차,
    // TODO: 링크스킬 · 길드스킬 · 캐시장비 · 헥사스탯 · 챌린저스 · 버닝 · 불릿
  };

  return stat;
}
