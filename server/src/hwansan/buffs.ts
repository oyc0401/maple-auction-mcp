// maplescouter "최종뎀 % 증가"와 값을 맞추기 위한 표준 버프(도핑 켠 상태) 반영.
//
// maplescouter는 넥슨 최종스탯을 그대로 쓰지 않고, 표준 버프를 얹은 값을 분모로 삼아
// "이 스탯 1당 딜 몇 %"를 계산한다. 우리도 같은 버프를 얹어야 딜상승률이 일치한다.
//
// ⚠️ 현재 값은 **캡틴 / 챌린저스 서버** 기준으로 역산·검증한 것이다.
//    검증: 꽈숩노(캡틴) 기준 주스탯·공격력·보총뎀·크뎀 → maplescouter 효율과 0.3% 이내 일치.
//    한계: (1) 방무는 near-cap 초민감으로 미세 오차 존재  (2) 직업/서버별 값은 아직 일반화 안 됨.
//    TODO: 직업별 버프 테이블화, 공격력 F(공% 적용 전) 기준 정식 반영, 방무 결합식 정밀화.
//
// 값 출처: 인게임 버프 툴팁(챌린저스·버닝·세이람·VIP·노블레스 등) + maplescouter 효율 대조.

import type { CharState } from './calc.js';

// 주스탯 버프 배수 — 세이람·물약·유니온 등. 캡틴 3인(꽈숩노·밥이선장·마린)에서 ×1.154로 일관 확인.
const MAIN_STAT_MUL = 1.154;

// 보스+데미지 합에 더하는 버프(%p): 챌린70 + 버닝20 + 훈련일지40 + 노블레스30 + 세이람10 + 빨간별20 + 대적자10.
const BOSS_DMG_BUFF = 200;

// 크리티컬 데미지에 더하는 버프(%p): 챌린40 + 세이람16 + 노블레스15.
const CRIT_DMG_BUFF = 71;

// 방어율 무시 버프(%, 곱연산): 버닝20 · 훈련20 · VIP15 · 원소내성5.
// 챌린저스 방무 70%는 100% 근처(near-cap)에서 그대로 곱하면 과대반영되어 제외한다
// (maplescouter 유효 방무 ~98.5%에 맞춤). 방무는 near-cap 초민감이라 여전히 근사다.
const IGNORE_DEF_BUFFS = [20, 20, 15, 5];

// 방무는 1 − ∏(1 − rᵢ/100)로 결합한다(곱연산). 100% 근처에서 초민감.
function combineIgnoreDef(base: number, buffs: number[]): number {
  let remain = 1 - base / 100;
  for (const b of buffs) remain *= 1 - b / 100;
  return 100 * (1 - remain);
}

// 넥슨 최종스탯(버프 전) → maplescouter 표준 버프 반영 상태.
// 딜상승률(교체 델타) 계산의 "분모"를 maplescouter와 맞추는 것이 목적.
export function applyStandardBuffs(s: CharState): CharState {
  return {
    ...s,
    // 주스탯: statFactor(4·주+부)에 ×1.154가 되도록 각 스탯을 배수 적용.
    str: s.str * MAIN_STAT_MUL,
    dex: s.dex * MAIN_STAT_MUL,
    int: s.int * MAIN_STAT_MUL,
    luk: s.luk * MAIN_STAT_MUL,
    damageBossSum: s.damageBossSum + BOSS_DMG_BUFF,
    critDamage: s.critDamage + CRIT_DMG_BUFF,
    ignoreDef: combineIgnoreDef(s.ignoreDef, IGNORE_DEF_BUFFS),
    // 공격력은 F(공% 적용 전 순수 공격력) 기준 재구성이 필요하나, 현재 calc.ts가 최종공격력을
    // 기준으로 교체 델타를 계산하므로 이번 버전에선 손대지 않는다(공격력 아이템만 근사).
    // TODO: 공% 분리 + F 기준 델타로 공격력 아이템 정확도 개선.
  };
}
