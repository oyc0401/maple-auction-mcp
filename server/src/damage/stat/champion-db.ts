// 유니온 챔피언 뱃지 합산 효과(champion_badge_total_info) → MapleTemplate.
// 뱃지엔 소스 키가 없어 스킬처럼 키로 못 나눔 → 뱃지 문자열 전체에 이 템플릿들을 훑는다.
// 올스탯·공마는 주스탯% 적용 대상(미적용 아님). "최대 HP/MP"는 룰 없음 → 미수집(legacy 계승).
import type { MapleTemplate } from './template-parser.js';

export const CHAMPION: MapleTemplate[] = [
  '올스탯 ${올스탯}',
  '공격력/마력 ${공/마} 증가',
  '보스 몬스터 공격 시 데미지 ${보공}% 증가',
  '크리티컬 데미지 ${크뎀}% 증가',
  '방어율 무시 ${방무}% 증가',
];
