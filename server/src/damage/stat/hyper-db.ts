// 하이퍼스탯 stat_type → MapleTemplate. 리터럴은 실측 stat_increase의 부분문자열이고,
// ${키}가 적용할 MapleStat을 결정한다. 하이퍼 주스탯은 주스탯%·올스탯% 미적용이라 ${STR미적용} 등.
// 딜 무관 stat_type(획득 경험치·일반 몬스터·상태 이상 내성·이속 등)은 룰 없음 → 자동 스킵.
import type { MapleTemplate } from './template-parser.js';

export type HyperRules = Record<string, MapleTemplate[]>;

export const HYPER: HyperRules = {
  STR: ['힘 ${STR미적용} 증가'],
  DEX: ['민첩성 ${DEX미적용} 증가'],
  INT: ['지력 ${INT미적용} 증가'],
  LUK: ['운 ${LUK미적용} 증가'],
  '공격력/마력': ['공격력과 마력 ${공/마} 증가'],
  '크리티컬 확률': ['크리티컬 확률 ${크확}% 증가'],
  '크리티컬 데미지': ['크리티컬 데미지 ${크뎀}% 증가'],
  데미지: ['데미지 ${데미지}% 증가'],
  '방어율 무시': ['방어율 무시 ${방무}% 증가'],
  '보스 몬스터 공격 시 데미지 증가': ['보스 몬스터 공격 시 데미지 ${보공}% 증가'],
  // 최대 HP(데몬어벤저 등)는 실측 덤프 미확보로 보류 — DA 덤프 확보 시 추가.
};
