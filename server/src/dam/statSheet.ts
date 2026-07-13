export type MainStat = 'STR' | 'DEX' | 'INT' | 'LUK';

export interface UserStat {
  flat: Record<MainStat, number>;
  flatNoPct: Record<MainStat, number>;
  pct: Record<MainStat, number>;
  allFlat: number;
  allPct: number;

  hpFlat: number;
  hpFlatNoPct: number;
  hpPct: number;

  atk: number;
  matk: number;
  atkPct: number;
  matkPct: number;

  damage: number;
  bossDmg: number;
  statusDmg: number;

  ignoreDef: number[];
  finalDmg: number[];

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
