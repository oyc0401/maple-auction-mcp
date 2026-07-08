// 직업별 주스탯 모델. StatFactor(데미지의 스탯 항) 계산식이 직업군에 따라 다르다.
//
// - standard: (4·주스탯 + 부스탯). 최종 STR/DEX/INT/LUK 최대값을 주스탯으로, 통상 규칙으로 부스탯.
//   (카데나·듀얼블레이더·섀도어 등 LUK주/DEX부 도적 포함)
// - xenon(제논): STR/DEX/LUK 3스탯을 함께 사용 → 4·(STR+DEX+LUK). (근사: 방향/우열 판별용)
// - hp(데몬어벤져): HP 기반 → 4·(순수HP/14 + 장비HP/17.5), 순수HP = 545 + level·90. (maplescouter 구버전식)
//
// 제논·데벤져 환산은 직업 상수 미반영이라 절대값은 근사지만, 무기/방어구 교체 시 강해지는지 여부는 판별된다.

export type MainStat = 'STR' | 'DEX' | 'INT' | 'LUK';

export type StatModel =
  | { kind: 'standard'; main: MainStat; sub: MainStat }
  | { kind: 'xenon' }
  | { kind: 'hp' };

const SUB_OF: Record<MainStat, MainStat> = { STR: 'DEX', DEX: 'STR', INT: 'LUK', LUK: 'DEX' };

function pickMain(stat: Record<string, number>): MainStat {
  const cand: [MainStat, number][] = [
    ['STR', stat['STR'] ?? 0],
    ['DEX', stat['DEX'] ?? 0],
    ['INT', stat['INT'] ?? 0],
    ['LUK', stat['LUK'] ?? 0],
  ];
  cand.sort((a, b) => b[1] - a[1]);
  return cand[0][0];
}

export function resolveStatModel(characterClass: string, stat: Record<string, number>): StatModel {
  if (characterClass === '제논') return { kind: 'xenon' };
  if (characterClass === '데몬어벤져') return { kind: 'hp' };
  const main = pickMain(stat);
  return { kind: 'standard', main, sub: SUB_OF[main] };
}

// INT 주력(마력 기준) 여부. xenon/hp는 물리(공격력) 기준.
export function isMagicModel(model: StatModel): boolean {
  return model.kind === 'standard' && model.main === 'INT';
}
