// maplescouter "최종뎀 % 증가"와 값을 맞추기 위한 표준 버프(도핑 켠 상태) 반영.
//
// maplescouter는 넥슨 최종스탯을 그대로 쓰지 않고, 표준 버프를 얹은 값을 분모로 삼아
// "이 스탯 1당 딜 몇 %"를 계산한다. 우리도 같은 버프를 얹어야 딜상승률이 일치한다.
//
// ⚠️ 일반화 수준(정직하게):
//    - 주스탯 배수(×1.154)만 실제로 일반화됨. 캡틴 3명(꽈숩노·밥이선장·마린)에서 오차 0.001 이내.
//    - 나머지(보총뎀·크뎀·공격력·방무)는 아래 값이 **꽈숩노 한 명에 맞춘 고정값**이다.
//      → 꽈숩노는 오차 ≈0이지만 다른 캐릭은 최대 0.64%p까지 벗어난다(마린 등). docs/final-damage-percent.md 참고.
//    - 근본 해결: 넥슨 부품(장비·유니온·하이퍼 등)에서 캐릭터별로 버프를 재구성해야 함(maplescouter 방식). TODO.
//
// 값 출처: 인게임 버프 툴팁(챌린저스·버닝·세이람·VIP·노블레스 등) + maplescouter 효율 대조.

import type { CharState } from './calc.js';

// 주스탯 버프 배수 — 세이람·물약·유니온 등. 캡틴 3인(꽈숩노·밥이선장·마린)에서 ×1.154로 일관 확인.
const MAIN_STAT_MUL = 1.154;

// 보스+데미지 합에 더하는 버프(%p): 챌린70 + 버닝20 + 훈련일지40 + 노블레스30 + 세이람10 + 빨간별20 + 대적자10.
const BOSS_DMG_BUFF = 200;

// 크리티컬 데미지에 더하는 버프(%p): 챌린40 + 세이람16 (노블레스 등 일부는 넥슨 중복으로 제외).
// maplescouter 유효 크뎀(꽈숩노 159) − 넥슨(102) = +57에 맞춤.
const CRIT_DMG_BUFF = 57;

// 방어율 무시 버프(%, 곱연산). 100% 근처(near-cap)에서 챌린저스 방무 70%를 그대로 곱하면
// 과대반영되므로, maplescouter 유효 방무(꽈숩노 ~98.54%)에 맞도록 조정한 값이다.
// 방무는 near-cap 초민감이라 여전히 근사(±0.1%p 수준).
const IGNORE_DEF_BUFFS = [20, 20, 15, 15];

// 공격력 F(공% 적용 전 순수 공격력) 재구성용.
//   F = 넥슨최종공격력 / (1 + 공%) + 표준스킬·도핑 flat 공격력
// maplescouter는 F를 분모로 쓰므로 넥슨 최종공격력(공% 적용 후)을 그대로 쓰면 어긋난다.
// ⚠️ 공%는 캐릭터별 분해값이 없어 캡틴 표준값(72%)으로 임시 고정. 직업/세팅별 정밀화 TODO.
const ATK_PERCENT = 72;
const ATK_FLAT_BUFF = 864; // 표준스킬(≈279) + 도핑(≈585) flat 공격력 합

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
    // 공격력(마법사는 마력): F(공% 적용 전) 기준으로 교체. 아이템 flat 공격력이 F에 더해져
    // 마진(Δ/F)이 maplescouter와 맞는다. (공% 아이템은 여전히 근사)
    attack: s.attack / (1 + ATK_PERCENT / 100) + ATK_FLAT_BUFF,
  };
}
