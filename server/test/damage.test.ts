import { describe, it, expect } from 'vitest';
import { aggregateCharacter, type RawBundle } from '../src/damage/nexon.js';
import { buildCombatStats, damageOf } from '../src/damage/combat.js';
import { swapDamageDelta, itemStatsToBlock } from '../src/damage/delta.js';
import { fromAuctionRaw } from '../src/hwansan2/axes.js';

// 최소 캐릭터 번들: 카데나(LUK 주스탯·이중부스탯), 반지1 + 무기.
// 방무를 실캐릭 수준(~82%)으로 확보해 반지 방무(10%)를 빼도 380 방무팩터가 양수를 유지하게 한다.
const ringEquip = {
  item_equipment_slot: '반지1', item_name: '테스트 링',
  item_total_option: { luk: '100', str: '10', attack_power: '20' },
  potential_option_1: '몬스터 방어율 무시 +10%', potential_option_2: 'LUK +9%', potential_option_3: null,
};
const weaponEquip = {
  item_equipment_slot: '무기', item_name: '테스트 체인',
  item_total_option: { attack_power: '500', luk: '50', boss_damage: '30' },
  potential_option_1: '몬스터 방어율 무시 +40%', potential_option_2: '공격력 +12%', potential_option_3: null,
};
function makeBundle(): RawBundle {
  return {
    stat: {
      character_class: '카데나',
      final_stat: [
        { stat_name: 'LUK', stat_value: '2000' }, { stat_name: 'STR', stat_value: '100' },
        { stat_name: 'DEX', stat_value: '100' }, { stat_name: 'INT', stat_value: '100' },
        { stat_name: 'AP 배분 LUK', stat_value: '1000' },
      ],
    },
    basic: { character_level: 270 },
    equip: { item_equipment: [ringEquip, weaponEquip] },
    setEff: null, symbol: null,
    hyper: { use_preset_no: 1, hyper_stat_preset_1: [{ stat_level: 7, stat_increase: '방어율 무시 21% 증가' }] },
    ability: null, link: null,
    union: { union_raider_stat: [], union_occupied_stat: [], union_state_stat: ['방어율 무시 40% 증가'] },
    artifact: { union_artifact_effect: [{ name: '몬스터 방어율 무시 20% 증가' }] },
    champion: null,
    propensity: { charisma_level: 100 }, // 방무 +10% (카리스마)
    skills: {}, hexa: null,
  };
}
const collected = aggregateCharacter('테스트', makeBundle(), []);
const cs = buildCombatStats(collected);

// 넥슨 장착템과 동일 스탯의 경매장 매물 toolTip (identity 스왑용)
const sameRingRaw = {
  _id: 'ring:1', itemName: '테스트 링',
  toolTip: {
    stat: { luk: 100, str: 10, pad: 20 },
    upgradeInfo: { potential: { grade: 3, entries: [{ text: '몬스터 방어율 무시 +10%' }, { text: 'LUK +9%' }] } },
  },
};

describe('damage/combat — D 공식', () => {
  it('축 판별: 카데나는 LUK 주스탯 + 이중부스탯(sub DEX, ssub STR)', () => {
    expect(cs.axes).toEqual({ kind: 'standard', main: 'LUK', sub: 'DEX', ssub: 'STR', isMagic: false });
  });

  it('D는 양수이고 보스 방어율이 높을수록 작다', () => {
    const d300 = damageOf(cs, { bossDef: 3.0 });
    const d380 = damageOf(cs, { bossDef: 3.8 });
    expect(d300).toBeGreaterThan(0);
    expect(d380).toBeGreaterThan(0);
    expect(d380).toBeLessThan(d300);
  });

  it('공격력이 오르면 D도 오른다', () => {
    const boosted = structuredClone(cs.us);
    boosted.atk += 100;
    expect(damageOf(cs, { bossDef: 3.0 }, boosted)).toBeGreaterThan(damageOf(cs, { bossDef: 3.0 }));
  });
});

describe('damage/delta — 교체 증감률', () => {
  it('넥슨 장착템 블록(단일 진실 원천)과 경매장 파서 블록이 같은 아이템에서 같은 스탯을 낸다', () => {
    const a = collected.stats.장비!['반지1'] as Record<string, number | number[]>;
    const b = itemStatsToBlock(fromAuctionRaw(sameRingRaw)) as Record<string, number | number[]>;
    expect(b['STR']).toBe(a['STR']);
    expect(b['LUK']).toBe(a['LUK']);
    expect(b['공격력']).toBe(a['공격력']);
    expect(b['LUK%']).toBe(a['LUK%']);
    expect((b['방무'] as number[])[0]).toBeCloseTo((a['방무'] as number[])[0], 10);
  });

  it('동일 스탯 매물로 교체하면 증감률 0%', () => {
    const r = swapDamageDelta(collected, cs, '반지1', sameRingRaw);
    expect(r).not.toBeNull();
    expect(r!.delta380).toBe(0);
  });

  it('공격력이 더 높은 매물은 양의 증감률, 낮으면 음수', () => {
    const better = structuredClone(sameRingRaw);
    better.toolTip.stat.pad = 120; // +100 공격력
    const worse = structuredClone(sameRingRaw);
    worse.toolTip.stat.pad = 0;
    const up = swapDamageDelta(collected, cs, '반지1', better)!;
    const down = swapDamageDelta(collected, cs, '반지1', worse)!;
    expect(up.delta380).toBeGreaterThan(0);
    expect(down.delta380).toBeLessThan(0);
  });

  it('방무 잠재가 사라지면 380 기준 증감률이 음수다 (방무 곱연산)', () => {
    const noIed = structuredClone(sameRingRaw);
    noIed.toolTip.upgradeInfo.potential!.entries = [{ text: 'LUK +9%' }];
    const r = swapDamageDelta(collected, cs, '반지1', noIed)!;
    expect(r.delta380).toBeLessThan(0);
  });

  it('없는 부위면 null', () => {
    expect(swapDamageDelta(collected, cs, '펜던트2', sameRingRaw)).toBeNull();
  });

  it('알 수 없는 옵션 문구는 unknown으로 노출하고, 계산 무관 옵션(방어력 등)은 조용히 무시한다', () => {
    const weird = structuredClone(sameRingRaw);
    weird.toolTip.upgradeInfo.potential!.entries.push({ text: '이상한 옵션 +3%' }, { text: '방어력 +100' });
    const r = swapDamageDelta(collected, cs, '반지1', weird)!;
    expect(r.unknown).toContain('이상한 옵션 +3%');
    expect(r.unknown).not.toContain('방어력 +100');
    expect(r.delta380).toBe(0); // 둘 다 D에 영향 없음
  });
});

describe('damage — 소스별 버킷 배치 규칙', () => {
  it('심볼 주스탯은 스탯%를 받지 않는 버킷(flatNoPct)에 들어간다', () => {
    const base = aggregateCharacter('테스트', makeBundle(), []).userStat;
    const b = makeBundle();
    b.symbol = { symbol: [{ symbol_luk: '1234' }] };
    const withSymbol = aggregateCharacter('테스트', b, []).userStat;
    // 심볼 LUK는 flatNoPct에만 더해지고 스탯% 적용 버킷(flat)은 그대로다.
    expect(withSymbol.flatNoPct.LUK - base.flatNoPct.LUK).toBe(1234);
    expect(withSymbol.flat.LUK).toBe(base.flat.LUK);
  });

  it('인텐시브 인썰트 링크는 상태이상·레벨낮은 몬스터 라인을 모두 추가뎀으로 합산한다', () => {
    const b = makeBundle();
    b.link = {
      character_link_skill: [{
        skill_name: '인텐시브 인썰트',
        skill_effect: '상태 이상에 걸린 몬스터 공격 시 데미지 6%, 캐릭터보다 레벨이 낮은 몬스터 공격 시 데미지 6%',
      }],
    };
    const col = aggregateCharacter('테스트', b, []);
    expect(col.userStat.statusDmg).toBe(12);
  });

  it('크리티컬 리인포스 보유 시 크확의 절반이 크뎀에 더해진다', () => {
    const b = makeBundle();
    b.skills = { '5': [{ skill_name: '크리티컬 리인포스', skill_level: 30, skill_effect: '' }] };
    const col = aggregateCharacter('테스트', b, []);
    const rcs = buildCombatStats(col);
    expect(rcs.critReinforcePct).toBe(50);
    // 크확 전량이 크뎀으로 전환돼 D가 오른다 (크리인포 미보유 대비).
    const withReinforce = damageOf(rcs, { bossDef: 3.0 });
    const noReinforce = damageOf({ ...rcs, critReinforcePct: 0 }, { bossDef: 3.0 });
    expect(withReinforce).toBeGreaterThan(noReinforce);
  });
});

describe('damage — 제논·데몬어벤져 축', () => {
  function makeFor(cls: string, extraStat: Record<string, string>[] = []): ReturnType<typeof aggregateCharacter> {
    const b = makeBundle();
    b.stat = { character_class: cls, final_stat: [...b.stat.final_stat, ...extraStat] };
    return aggregateCharacter('테스트', b, []);
  }

  it('제논: 3스탯 합 축 — 올스탯% 매물이 단일 스탯%보다 효율이 높다', () => {
    // STR/DEX 베이스를 줘야 스탯% 델타가 floor에서 살아남는다 (제논은 3스탯 분산 육성)
    const col = makeFor('제논', [
      { stat_name: 'AP 배분 STR', stat_value: '500' }, { stat_name: 'AP 배분 DEX', stat_value: '500' },
    ]);
    const xcs = buildCombatStats(col);
    expect(xcs.axes).toEqual({ kind: 'xenon' });
    const allPctRaw = structuredClone(sameRingRaw);
    allPctRaw.toolTip.upgradeInfo.potential!.entries.push({ text: '올스탯 +6%' });
    const onePctRaw = structuredClone(sameRingRaw);
    onePctRaw.toolTip.upgradeInfo.potential!.entries.push({ text: 'STR +6%' });
    const all = swapDamageDelta(col, xcs, '반지1', allPctRaw)!;
    const one = swapDamageDelta(col, xcs, '반지1', onePctRaw)!;
    expect(all.delta380).toBeGreaterThan(one.delta380);
    expect(one.delta380).toBeGreaterThan(0);
  });

  it('데몬어벤져: HP 축 — 최대 HP 매물이 D를 올리고, 미검증 노트를 단다', () => {
    const col = makeFor('데몬어벤져', [{ stat_name: 'HP', stat_value: '50000' }]);
    const dcs = buildCombatStats(col);
    expect(dcs.axes).toEqual({ kind: 'da' });
    expect(dcs.notes.join(' ')).toContain('제논·데몬어벤져');
    const hpRaw = structuredClone(sameRingRaw) as any;
    hpRaw.toolTip.stat.mhp = 3000;
    const r = swapDamageDelta(col, dcs, '반지1', hpRaw)!;
    expect(r.delta380).toBeGreaterThan(0);
  });
});
