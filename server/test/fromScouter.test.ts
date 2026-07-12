import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import type { ScouterUserStat } from '../src/scouter/dmgSimulatorPayload.js';
import { scouterToUserStat, combatStatsFromScouter } from '../src/damage/fromScouter.js';
import { damageOf } from '../src/damage/combat.js';
import { addBlock } from '../src/damage/block.js';
import type { StatBlock } from '../src/damage/stat-interface.js';

// 골든: dmg-simulator-payload.userStat = 오유찬(카데나) 실측 ScouterUserStat.
// 원 API는 수치를 문자열로 주므로 number 로 정규화해 우리 타입에 태운다.
const numify = (o: any): any =>
  Array.isArray(o) ? o.map(numify)
    : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, numify(v)]))
      : typeof o === 'string' && o !== '' && !isNaN(Number(o)) ? Number(o) : o;

const goldenUrl = new URL('../src/scouter/dmg-simulator-payload', import.meta.url);
const golden: ScouterUserStat = numify(JSON.parse(readFileSync(goldenUrl, 'utf8')).userStat);

describe('fromScouter/scouterToUserStat — 오유찬(카데나) 변환', () => {
  it('주스탯 축을 base/per/abs 그대로 축별 버킷에 싣는다 (카데나 main=LUK)', () => {
    const u = scouterToUserStat(golden);
    expect(u.flat.LUK).toBe(4055);      // mainStatBase
    expect(u.pct.LUK).toBe(326);        // mainStatPer
    expect(u.flatNoPct.LUK).toBe(17420); // mainStatAbs
    // 이중부스탯: sub=DEX, ssub=STR
    expect(u.flat.DEX).toBe(1608);
    expect(u.flat.STR).toBe(881);
    // 올스탯은 축별에 접힘 → allFlat/allPct 는 0
    expect(u.allFlat).toBe(0);
    expect(u.allPct).toBe(0);
  });

  it('공격력·데미지·크리·방무를 매핑한다', () => {
    const u = scouterToUserStat(golden);
    expect(u.atk).toBe(1745);           // atkBase (무기공 포함)
    expect(u.atkPct).toBe(69);          // atkPercent
    expect(u.damage).toBe(73);          // dmg
    expect(u.bossDmg).toBe(320);
    expect(u.statusDmg).toBe(14);       // statusAdditionalDmg
    expect(u.critRate).toBe(113);       // critical
    expect(u.critDmg).toBe(78);         // criticalDmg (기본35·리인포 포함)
    expect(u.ignoreDef).toEqual([93.9669]); // 합산 방무% → 1원소 배열
    expect(u.finalDmg).toEqual([]);     // 최종뎀 필드 없음 → 빈 배열(증감률에서 상쇄)
  });

  it('CombatStats 로 D 를 낼 수 있고, 공격력을 더하면 증감률이 양수다', () => {
    const cs = combatStatsFromScouter(golden);
    const before = damageOf(cs, { bossDef: 3.8 });
    expect(before).toBeGreaterThan(0);
    // 기존 + 스탯(공격력 +30) → 증감률
    const usAfter = structuredClone(cs.us);
    addBlock(usAfter, { 공격력: 30 } as StatBlock, cs.level);
    const after = damageOf(cs, { bossDef: 3.8 }, usAfter);
    const deltaPct = (after / before - 1) * 100;
    expect(deltaPct).toBeGreaterThan(0);
  });

  it('보스 방어율이 높을수록 D 가 작다 (방무 곱연산 재현)', () => {
    const cs = combatStatsFromScouter(golden);
    expect(damageOf(cs, { bossDef: 3.0 })).toBeGreaterThan(damageOf(cs, { bossDef: 3.8 }));
  });
});
