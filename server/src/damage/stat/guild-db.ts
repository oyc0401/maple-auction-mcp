// 길드 스킬(길드의 노하우 등) 상시 패시브 효과 → MapleTemplate. 주스탯·공/마는 %적용(레거시 계승).
// 딜 무관(일반몹·받는피해·경험치·아케인포스·체력 등)은 룰 없음 → 자동 스킵. 버프(N분/초 동안)는 호출부에서 제외.
import type { MapleTemplate } from './template-parser.js';

export const GUILD: MapleTemplate[] = [
  '공격력 ${공격력}',
  '마력 ${마력}',
  '힘 ${STR}',
  '민첩 ${DEX}',
  '지력 ${INT}',
  '운 ${LUK}',
];
