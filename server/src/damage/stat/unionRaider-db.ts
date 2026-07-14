// 유니온 공격대원 배치 효과(union_raider_stat) → MapleTemplate. 문자열에 최종 수치가 박혀 있음. 반복 라인은 누산.
// 주스탯·올스탯·HP는 주스탯%·올스탯% 미적용(레거시 noPct=true) → ${…미적용}.
// 딜 무관 라인(경험치·메소·MP·버프지속·이속·회복·확률성·상태이상내성·소환수·스킬재사용 등)은 룰 없음 → 자동 스킵.
import type { MapleTemplate } from './template-parser.js';

export const UNION_RAIDER: MapleTemplate[] = [
  'STR, DEX, LUK ${STR/DEX/LUK미적용} 증가', // 공유값 복합 라인 — 먼저(구체)
  'ALLSTAT ${올스탯미적용}', // "ALLSTAT 40, 최대 HP 2000 증가"의 분해 세그먼트(증가 없음)
  'STR ${STR미적용} 증가',
  'DEX ${DEX미적용} 증가',
  'INT ${INT미적용} 증가',
  'LUK ${LUK미적용} 증가',
  '공격력/마력 ${공/마} 증가',
  '최대 HP ${HP미적용} 증가', // 깡 HP(데몬어벤저 등) — % 라인보다 먼저
  '최대 HP ${HP퍼}% 증가',
  '보스 몬스터 공격 시 데미지 ${보공}% 증가',
  '방어율 무시 ${방무}% 증가',
  '크리티컬 데미지 ${크뎀}% 증가',
  '크리티컬 확률 ${크확}% 증가',
];
