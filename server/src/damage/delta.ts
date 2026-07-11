// 장비 교체 → 최종 데미지 증감률(D_after/D_before − 1).
// 매물 파싱은 구 hwansan2의 검증된 파서(fromAuctionRaw·optionDict)를 그대로 재사용하고,
// 시뮬레이터 POST 대신 combat.ts의 로컬 D 공식으로 계산한다.
import { fromAuctionRaw, accumLine, emptyItemStats, type ItemStats, type Stat4 } from '../hwansan2/axes.js';
import { setSwapStatsByNames, normalizeSet } from '../hwansan2/sets.js';
import type { UserStat } from './statSheet.js';
import type { CharacterCollected } from './nexon.js';
import { damageOf, type CombatStats } from './combat.js';

// 넥슨 착용 장비(item-equipment 항목) → ItemStats. 구 fromScouterEquip과 동형이지만
// 넥슨은 잠재가 배열이 아니라 문자열 필드(potential_option_1..3)다.
export function fromNexonEquip(item: any): ItemStats {
  const s = emptyItemStats();
  const t = item?.item_total_option ?? {};
  const n = (k: string) => Number(t[k] ?? 0);
  s.flat.STR += n('str'); s.flat.DEX += n('dex'); s.flat.INT += n('int'); s.flat.LUK += n('luk');
  s.hp += n('max_hp'); s.atk += n('attack_power'); s.matk += n('magic_power');
  s.dispAtk = n('attack_power'); s.dispMatk = n('magic_power');
  s.dmgBoss += n('boss_damage') + n('damage');
  s.allPct += n('all_stat'); // 넥슨 total의 all_stat은 %값(추옵 올스탯%)
  const ied = n('ignore_monster_armor');
  if (ied) s.iedFactor *= 1 - ied / 100;
  for (const k of ['potential_option_1', 'potential_option_2', 'potential_option_3',
    'additional_potential_option_1', 'additional_potential_option_2', 'additional_potential_option_3']) {
    accumLine(s, item?.[k]);
  }
  accumLine(s, item?.soul_option);
  return s;
}

// 순변화(새 − 현재 + 세트델타). sets.ts의 mergeStats는 세트에 없는 필드(perLev·critRate·hpPct 등)를
// 병합하지 않아 아이템 net에 재사용하면 안 된다 — 전 필드를 직접 계산한다. 방무는 곱연산(×next ÷cur ×set).
function netStats(next: ItemStats, cur: ItemStats, setDelta: ItemStats): ItemStats {
  const n = emptyItemStats();
  const d = (f: (s: ItemStats) => number) => f(next) - f(cur) + f(setDelta);
  for (const k of ['STR', 'DEX', 'INT', 'LUK'] as Stat4[]) {
    n.flat[k] = d((s) => s.flat[k]);
    n.pct[k] = d((s) => s.pct[k]);
    n.perLev[k] = d((s) => s.perLev[k]);
  }
  n.hp = d((s) => s.hp); n.hpPct = d((s) => s.hpPct);
  n.atk = d((s) => s.atk); n.matk = d((s) => s.matk);
  n.atkPct = d((s) => s.atkPct); n.matkPct = d((s) => s.matkPct);
  n.allPct = d((s) => s.allPct);
  n.dmgBoss = d((s) => s.dmgBoss);
  n.critDmg = d((s) => s.critDmg); n.critRate = d((s) => s.critRate);
  n.finalDmg = d((s) => s.finalDmg);
  n.iedFactor = (next.iedFactor * setDelta.iedFactor) / (cur.iedFactor || 1);
  return n;
}

// ItemStats 순변화를 UserStat 사본에 적용.
// 방무는 곱연산이라 계수(iedFactor)를 "(1−v/100)=f"인 합성 소스 v로 넣는다 (f>1도 음수 v로 정확).
function applyNet(base: UserStat, net: ItemStats, level: number): UserStat {
  const us = structuredClone(base);
  const lv9 = Math.floor(level / 9);
  for (const k of ['STR', 'DEX', 'INT', 'LUK'] as Stat4[]) {
    us.flat[k] += net.flat[k] + lv9 * net.perLev[k];
    us.pct[k] += net.pct[k];
  }
  us.allPct += net.allPct;
  us.hpFlat += net.hp; us.hpPct += net.hpPct;
  us.atk += net.atk; us.matk += net.matk;
  us.atkPct += net.atkPct; us.matkPct += net.matkPct;
  us.damage += net.dmgBoss; // 뎀%+보공%는 D 공식에서 합산 등가
  us.critDmg += net.critDmg;
  us.critRate += net.critRate;
  if (net.finalDmg) us.finalDmg.push(net.finalDmg);
  if (net.iedFactor !== 1) us.ignoreDef.push((1 - net.iedFactor) * 100);
  return us;
}

export interface SwapResult {
  delta300: number; // 보스 방어율 300% 기준 증감률 % (예: +2.31)
  delta380: number;
  unknown: string[];
}

const round2 = (v: number) => Math.round(v * 100) / 100;

// 현재 slot 장비를 경매장 매물로 교체할 때의 최종 데미지 증감률.
export function swapDamageDelta(
  collected: CharacterCollected,
  cs: CombatStats,
  slot: string,
  newItemRaw: any
): SwapResult | null {
  const equips: any[] = collected.raw.equip?.item_equipment ?? [];
  const cur = equips.find((e) => e.item_equipment_slot === slot);
  if (!cur) return null;

  const curStats = fromNexonEquip(cur);
  const nextStats = fromAuctionRaw(newItemRaw);
  const unknown = new Set([...curStats.unknown, ...nextStats.unknown]);
  const newName = String(newItemRaw?.itemName ?? '');

  // 제네시스 무기 해방 효과(최종뎀 +10) — 구 swap.ts와 동일 정책 (해방 여부 미제공 → 제네시스면 해방 간주)
  if (slot === '무기') {
    if (/^제네시스 /.test(String(cur.item_name ?? ''))) curStats.finalDmg += 10;
    if (/^제네시스 /.test(newName)) nextStats.finalDmg += 10;
  }

  // 세트 델타: 교체 전/후 이름 목록으로 각각 countSets(럭키 재판정 포함). 여명 전환 수는 넥슨 set-effect에서.
  const names = equips.map((e) => String(e.item_name ?? ''));
  const idx = equips.findIndex((e) => e.item_equipment_slot === slot);
  const namesAfter = [...names];
  namesAfter[idx] = newName;
  const dawn = (collected.raw.setEff?.set_effect ?? []).find((s: any) => /여명/.test(String(s.set_name ?? '')));
  const setOpts = { aliases: {} as Record<string, string>, dawnCount: Number(dawn?.total_set_count ?? 0) };
  const officialNewSet = normalizeSet(newItemRaw?.toolTip?.setEffects?.[0]);
  if (officialNewSet) setOpts.aliases[newName] = officialNewSet;
  const setDelta = setSwapStatsByNames(names, namesAfter, setOpts);

  // 순변화 = 새 − 현재 + 세트델타 (방무는 곱연산으로 처리)
  const net = netStats(nextStats, curStats, setDelta);
  const usAfter = applyNet(cs.us, net, cs.level);

  const deltaAt = (bossDef: number) => {
    const before = damageOf(cs, { bossDef });
    const after = damageOf(cs, { bossDef, critRateDelta: net.critRate }, usAfter);
    return before > 0 ? round2((after / before - 1) * 100) : 0;
  };
  return { delta300: deltaAt(3.0), delta380: deltaAt(3.8), unknown: [...unknown] };
}
