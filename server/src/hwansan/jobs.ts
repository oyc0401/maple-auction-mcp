// 직업별 주스탯/부스탯 판정. Δ환산은 (4·주스탯 + 부스탯) 구조라 주·부스탯 종류가 정확해야 한다.
//
// - 표준 직업: 최종 STR/DEX/INT/LUK 최대값을 주스탯으로, 직업군 통상 규칙으로 부스탯을 정한다.
//   (카데나·듀얼블레이드·섀도어 등 LUK주/DEX부 도적 포함 — 부스탯 1개라 정상 처리)
// - 특수 직업: 제논(STR/DEX/LUK 3스탯 합산), 데몬어벤져(HP 기반)는 공식이 달라 별도 처리가 필요하다.
//   정식 공식 이식 전까지는 'unsupported'로 표시해 환산을 생략한다(틀린 값을 내지 않기 위함).

export type MainStat = 'STR' | 'DEX' | 'INT' | 'LUK';

export type StatModel =
  | { kind: 'standard'; main: MainStat; sub: MainStat }
  | { kind: 'unsupported'; reason: string };

// 주스탯 종류 → 부스탯 종류 (직업군 통상 규칙).
const SUB_OF: Record<MainStat, MainStat> = { STR: 'DEX', DEX: 'STR', INT: 'LUK', LUK: 'DEX' };

// 아직 환산 미지원인 특수 스탯 직업 (넥슨 character_class 명).
const UNSUPPORTED: Record<string, string> = {
  제논: '제논은 STR/DEX/LUK 3스탯 합산이라 별도 공식 필요',
  데몬어벤져: '데몬어벤져는 HP 기반이라 별도 공식 필요',
};

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

// character_class + 최종 스탯맵으로 주스탯 모델을 결정한다.
export function resolveStatModel(characterClass: string, stat: Record<string, number>): StatModel {
  const reason = UNSUPPORTED[characterClass];
  if (reason) return { kind: 'unsupported', reason };
  const main = pickMain(stat);
  return { kind: 'standard', main, sub: SUB_OF[main] };
}
