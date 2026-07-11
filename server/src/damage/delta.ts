// 장비 교체 → 최종 데미지 증감률(D_after/D_before − 1).
// 매물 파싱은 구 hwansan2의 검증된 파서(fromAuctionRaw·optionDict·sets)를 재사용하되,
// 계산은 StatBlock으로 정규화해 block.ts의 가산/반전 규칙 + combat.ts의 로컬 D 공식으로 한다.
// 현재 장착템 스탯은 별도 파싱 없이 단일 진실 원천(collected.stats.장비)의 블록을 그대로 쓴다.
import { fromAuctionRaw, type ItemStats, type Stat4 } from '../hwansan2/axes.js';
import { parseOptionLine } from '../hwansan2/optionDict.js';
import { setSwapStatsByNames, normalizeSet } from '../hwansan2/sets.js';
import type { StatBlock } from './stat-interface.js';
import type { CharacterCollected } from './nexon.js';
import { SLOT_KEY } from './character.js';
import { addBlock, negateBlock } from './block.js';
import { damageOf, type CombatStats } from './combat.js';

// hwansan2 ItemStats → StatBlock 어댑터. 방무는 곱연산 계수(iedFactor)를 (1−v/100)=f가 되는 합성 소스 v
// 하나로 옮긴다. f>1이면 v가 음수가 되므로 세트 델타처럼 부호가 섞인 입력도 정확히 표현된다.
// dmgBoss는 데미지%와 보공%의 합인데 D 공식에서 두 항이 같은 자리에 더해지므로 보공 한 칸에 싣는다.
export function itemStatsToBlock(s: ItemStats): StatBlock {
  const b: Record<string, number | number[]> = {};
  for (const k of ['STR', 'DEX', 'INT', 'LUK'] as Stat4[]) {
    if (s.flat[k]) b[k] = s.flat[k];
    if (s.pct[k]) b[`${k}%`] = s.pct[k];
    if (s.perLev[k]) b[`레벨당${k}`] = s.perLev[k];
  }
  if (s.allPct) b['올스탯%'] = s.allPct;
  if (s.atk) b['공격력'] = s.atk;
  if (s.matk) b['마력'] = s.matk;
  if (s.atkPct) b['공격력%'] = s.atkPct;
  if (s.matkPct) b['마력%'] = s.matkPct;
  if (s.dmgBoss) b['보공'] = s.dmgBoss;
  if (s.iedFactor !== 1) b['방무'] = [(1 - s.iedFactor) * 100];
  if (s.finalDmg) b['최종뎀'] = [s.finalDmg];
  if (s.critRate) b['크확'] = s.critRate;
  if (s.critDmg) b['크뎀'] = s.critDmg;
  if (s.hp) b['HP'] = s.hp;
  if (s.hpPct) b['HP%'] = s.hpPct;
  if (s.coolSec) b['쿨감'] = s.coolSec;
  return b as StatBlock;
}

// 장착템 옵션 라인 중 optionDict가 모르는 문구 (매물 쪽 unknown과 합쳐 사용자에게 노출)
const POTENTIAL_KEYS = [
  'potential_option_1', 'potential_option_2', 'potential_option_3',
  'additional_potential_option_1', 'additional_potential_option_2', 'additional_potential_option_3',
];
function unknownLines(item: any): string[] {
  const out: string[] = [];
  for (const line of [...POTENTIAL_KEYS.map((k) => item?.[k]), item?.soul_option]) {
    const p = parseOptionLine(line);
    if (p && 'unknown' in p) out.push(p.unknown);
  }
  return out;
}

export interface SwapResult {
  delta380: number; // 보스 방어율 380% 기준 증감률 % (예: +2.31)
  unknown: string[];
}

const round2 = (v: number) => Math.round(v * 100) / 100 || 0; // 곱연산 역수 계산의 부동소수점 잔재로 생기는 −0을 0으로 정규화
const num = (b: StatBlock, k: string) => ((b as Record<string, number>)[k] ?? 0);

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

  const gearBlocks = (collected.stats.장비 ?? {}) as Record<string, StatBlock>;
  const curBlock: StatBlock = { ...(gearBlocks[SLOT_KEY[slot] ?? slot] ?? {}) };
  const nextStats = fromAuctionRaw(newItemRaw);
  const newBlock = itemStatsToBlock(nextStats);
  const unknown = new Set([...unknownLines(cur), ...nextStats.unknown]);
  const newName = String(newItemRaw?.itemName ?? '');

  // 제네시스 무기 해방 효과(최종뎀 +10) — 구 swap.ts와 동일 정책 (해방 여부 미제공 → 제네시스면 해방 간주)
  if (slot === '무기') {
    if (/^제네시스 /.test(String(cur.item_name ?? ''))) curBlock.최종뎀 = [...(curBlock.최종뎀 ?? []), 10];
    if (/^제네시스 /.test(newName)) newBlock.최종뎀 = [...(newBlock.최종뎀 ?? []), 10];
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
  const setDeltaBlock = itemStatsToBlock(setSwapStatsByNames(names, namesAfter, setOpts));

  // 교체 적용본 = 현재 버킷 + 새 매물 + 세트델타 − 현재 장착템 (곱연산은 negateBlock이 역수 계수로 처리)
  const usAfter = structuredClone(cs.us);
  addBlock(usAfter, newBlock, cs.level);
  addBlock(usAfter, setDeltaBlock, cs.level);
  addBlock(usAfter, negateBlock(curBlock), cs.level);
  const critRateDelta = num(newBlock, '크확') + num(setDeltaBlock, '크확') - num(curBlock, '크확');

  const deltaAt = (bossDef: number) => {
    const before = damageOf(cs, { bossDef });
    const after = damageOf(cs, { bossDef, critRateDelta }, usAfter);
    return before > 0 ? round2((after / before - 1) * 100) : 0;
  };
  return { delta380: deltaAt(3.8), unknown: [...unknown] };
}
