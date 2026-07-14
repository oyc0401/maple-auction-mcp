// 유니온 점령 효과(union_state_stat + union_occupied_stat) → MapleTemplate. 문자열에 최종 수치가 박혀 있음.
// 주스탯은 %적용 → 일반 버킷. 딜 무관 라인(경험치·일반몹·버프지속 등)은 자동 스킵.
// ⚠️ 바 '데미지'는 '보스/크리티컬 데미지'의 부분문자열 → 반드시 뒤에 둘 것(첫 매칭 우선).
import type { MapleTemplate } from './template-parser.js';

export const UNION_STATE: MapleTemplate[] = [
  '올스탯 ${올스탯} 증가',
  'STR ${STR} 증가',
  'DEX ${DEX} 증가',
  'INT ${INT} 증가',
  'LUK ${LUK} 증가',
  '공격력 ${공격력} 증가',
  '마력 ${마력} 증가',
  '보스 몬스터 공격 시 데미지 ${보공}% 증가',
  '방어율 무시 ${방무}% 증가',
  '크리티컬 데미지 ${크뎀}% 증가',
  '크리티컬 확률 ${크확}% 증가',
  '데미지 ${데미지}% 증가', // 바 데미지 — 위 구체 템플릿 뒤
];
