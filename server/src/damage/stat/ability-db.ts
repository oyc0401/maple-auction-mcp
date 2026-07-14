// 어빌리티 라인(ability_info[].ability_value) → MapleTemplate. ability_value에 최종 수치가 박혀 있음.
// 주스탯·공/마는 %적용(미적용 아님). 상태이상 대상 데미지는 추가뎀으로.
// ⚠️ 바 '데미지'는 '보스 …/상태 이상 … 데미지'의 부분문자열 → 반드시 뒤에 둘 것(첫 매칭 우선).
import type { MapleTemplate } from './template-parser.js';

export const ABILITY: MapleTemplate[] = [
  '올스탯 ${올스탯} 증가',
  'STR ${STR} 증가',
  'DEX ${DEX} 증가',
  'INT ${INT} 증가',
  'LUK ${LUK} 증가',
  '공격력 ${공격력} 증가',
  '마력 ${마력} 증가',
  '크리티컬 확률 ${크확}% 증가',
  '보스 몬스터 공격 시 데미지 ${보공}% 증가',
  '상태 이상에 걸린 대상 공격 시 데미지 ${추가뎀}% 증가',
  '데미지 ${데미지}% 증가', // 바 데미지 — 위 구체 템플릿 뒤
];
