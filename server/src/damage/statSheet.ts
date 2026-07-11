// 유저의 모든 스탯을 소스(장비·세트·심볼·하이퍼·어빌·유니온…)에서 모아 담는 누적 버킷.
// 결합 규칙이 다르므로 버킷을 분리한다:
//   - 깡 주스탯/올스탯: 가산 (그리고 스탯%의 곱 대상)
//   - 주스탯%/올스탯%: 가산 (마지막에 (1+합/100)로 곱)
//   - 데미지·보공: 가산
//   - 방무·최종뎀: 곱연산 → 계수 목록으로 보관
//   - 크확·크뎀: 가산
// "다 모으기"가 1차 목표. 재구성 검증·교체 계산은 이 버킷 위에서 다음 단계.

export type MainStat = 'STR' | 'DEX' | 'INT' | 'LUK';

export interface UserStat {
  // ── 주스탯 ─────────────────────────────
  flat: Record<MainStat, number>;      // 깡 주스탯 (스탯% 적용 대상)
  flatNoPct: Record<MainStat, number>; // 깡 주스탯 (스탯% 안 받음 — 마지막에 그냥 가산)
  pct: Record<MainStat, number>;       // 주스탯 %
  allFlat: number;                     // 올스탯 깡 (스탯% 적용 대상)
  allPct: number;                      // 올스탯 %

  // ── HP (데몬어벤져용) ──────────────────
  hpFlat: number;       // 깡 HP (HP% 적용 대상)
  hpFlatNoPct: number;  // 깡 HP (HP% 안 받음)
  hpPct: number;

  // ── 공격력 / 마력 ──────────────────────
  atk: number;
  matk: number;
  atkPct: number;
  matkPct: number;

  // ── 데미지 계열 (가산) ─────────────────
  damage: number;    // 데미지 %
  bossDmg: number;   // 보스 몬스터 데미지 %
  statusDmg: number; // 추가 데미지 % (상추뎀, 레벨 낮은보스 데미지, 스택형 데미지 등등)

  // ── 곱연산 계열 (계수 목록) ────────────
  ignoreDef: number[];   // 몬스터 방어율 무시 % (각 소스별) → ∏(1−v/100)
  finalDmg: number[];    // 최종 데미지 % (각 소스별) → ∏(1+v/100)

  // ── 크리티컬 ───────────────────────────
  critRate: number;
  critDmg: number;
}

export function emptyUserStat(): UserStat {
  return {
    flat: { STR: 0, DEX: 0, INT: 0, LUK: 0 },
    flatNoPct: { STR: 0, DEX: 0, INT: 0, LUK: 0 },
    pct: { STR: 0, DEX: 0, INT: 0, LUK: 0 },
    allFlat: 0,
    allPct: 0,
    hpFlat: 0,
    hpFlatNoPct: 0,
    hpPct: 0,
    atk: 0,
    matk: 0,
    atkPct: 0,
    matkPct: 0,
    damage: 0,
    bossDmg: 0,
    statusDmg: 0,
    ignoreDef: [],
    finalDmg: [],
    critRate: 0,
    critDmg: 0,
  };
}
