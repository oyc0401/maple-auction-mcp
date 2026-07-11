// 전투 스탯 시트 + 로컬 D(데미지 지표) 공식.
// 인터페이스는 구 maplescouter dmg-simulator payload(stat/simulator 축)를 차용하되 계산은 로컬.
// D는 절대값이 아니라 비율용 지표 — 직업 상수·숙련도 등 공통 배수는 D_after/D_before에서 상쇄된다.
import type { UserStat, MainStat } from './statSheet.js';
import type { CharacterCollected, RawBundle } from './nexon.js';
import { aggregateCharacter } from './nexon.js';

// 직업별 스탯 축 (구 hwansan2/axes.ts statAxes 이식 — scouter 타입 의존 제거).
// 이중부스탯(카데나·듀얼블레이드·섀도어): sub=DEX, ssub=STR. 데벤=HP축, 제논=3스탯 합.
const DOUBLE_SUB = new Set(['카데나', '듀얼블레이드', '섀도어']);
const SUB_OF: Record<MainStat, MainStat> = { STR: 'DEX', DEX: 'STR', INT: 'LUK', LUK: 'DEX' };

export type StatAxes =
  | { kind: 'standard'; main: MainStat; sub: MainStat; ssub: MainStat | null; isMagic: boolean }
  | { kind: 'da' }     // 데몬어벤져: HP 주스탯 + sub STR (HP/3.5 환산 — 미검증, 노트 표기)
  | { kind: 'xenon' }; // 제논: STR+DEX+LUK 합 (합산 스케일은 비율에서 상쇄)

export function statAxesOf(myClass: string, finalMain: Record<string, number>): StatAxes {
  if (myClass === '데몬어벤져') return { kind: 'da' };
  if (myClass === '제논') return { kind: 'xenon' };
  const cand: [MainStat, number][] = [
    ['STR', finalMain['STR'] ?? 0], ['DEX', finalMain['DEX'] ?? 0],
    ['INT', finalMain['INT'] ?? 0], ['LUK', finalMain['LUK'] ?? 0],
  ];
  cand.sort((a, b) => b[1] - a[1]);
  const main = cand[0][0];
  if (DOUBLE_SUB.has(myClass)) return { kind: 'standard', main, sub: 'DEX', ssub: 'STR', isMagic: false };
  return { kind: 'standard', main, sub: SUB_OF[main], ssub: null, isMagic: main === 'INT' };
}

export interface CombatStats {
  myClass: string;
  level: number;
  axes: StatAxes;
  us: UserStat;           // 전투(cond 포함) 합산 버킷
  critRateTotal: number;  // us.critRate + 베이스 5 (크리인포 전환의 입력)
  critReinforce: boolean; // 크리티컬 리인포스 보유 (5차)
  notes: string[];        // 계산 주의사항 (미검증 축 등)
}

const BASE_CRIT_RATE = 5;  // 모든 캐릭터 기본 크확 (넥슨 크확 필드 포함 실측)
const BASE_CRIT_DMG = 35;  // 크리티컬 기본 데미지 배율 %p (크리팩터 = 1 + (35+크뎀)/100)

// CharacterCollected(레스팅 검증용) → 전투 스탯 시트. 조건부 링크·버프 스킬 포함해 재집계한다.
export function buildCombatStats(collected: CharacterCollected): CombatStats {
  const bundle = collected.raw.bundle as RawBundle;
  const combat = aggregateCharacter(collected.final.characterName, bundle, [], true);
  const us = combat.userStat;
  const myClass = collected.final.characterClass;
  const axes = statAxesOf(myClass, collected.final.finalMain);

  // 크리티컬 리인포스(5차 공용): 모든 크확 수집이 끝난 뒤 "가장 마지막에" 크확의 50%를 크뎀으로 전환(유저 방침).
  const critReinforce = (bundle.skills?.['5'] ?? []).some((s) => s.skill_name === '크리티컬 리인포스');
  const critRateTotal = us.critRate + BASE_CRIT_RATE;

  const notes: string[] = [];
  if (axes.kind !== 'standard') notes.push('제논·데몬어벤져 축은 미검증 — 증감률 참고용');

  return { myClass, level: collected.final.level, axes, us, critRateTotal, critReinforce, notes };
}

const statFinal = (us: UserStat, k: MainStat) =>
  Math.floor((us.flat[k] + us.allFlat) * (1 + (us.pct[k] + us.allPct) / 100)) + us.flatNoPct[k];
const hpFinal = (us: UserStat) => Math.floor(us.hpFlat * (1 + us.hpPct / 100)) + us.hpFlatNoPct;

// 스탯팩터: 4×주스탯 + 부스탯(+제2부스탯). 데벤은 HP/3.5를 주스탯으로 환산(커뮤니티 공식, 미검증).
function statFactor(cs: CombatStats, us: UserStat): number {
  const ax = cs.axes;
  if (ax.kind === 'da') return 4 * Math.floor(hpFinal(us) / 3.5) + statFinal(us, 'STR');
  if (ax.kind === 'xenon') return 4 * (statFinal(us, 'STR') + statFinal(us, 'DEX') + statFinal(us, 'LUK'));
  return 4 * statFinal(us, ax.main) + statFinal(us, ax.sub) + (ax.ssub ? statFinal(us, ax.ssub) : 0);
}

export interface DamageOpts {
  bossDef: number;          // 보스 방어율 (3.0 = 300%, 3.8 = 380%)
  critRateDelta?: number;   // 아이템 교체로 인한 크확 변화 (크리인포 전환 입력에 반영)
}

// D = 스탯팩터 × 공격력 × 뎀팩터 × 크리팩터 × 방무팩터 × 최종뎀. usOverride는 교체 적용본.
export function damageOf(cs: CombatStats, opts: DamageOpts, usOverride?: UserStat): number {
  const us = usOverride ?? cs.us;
  const isMagic = cs.axes.kind === 'standard' && cs.axes.isMagic;
  const atk = Math.floor((isMagic ? us.matk : us.atk) * (1 + (isMagic ? us.matkPct : us.atkPct) / 100));
  const dmgFactor = 1 + (us.damage + us.bossDmg + us.statusDmg) / 100; // 보스 상시 상태이상 가정(유저 방침)
  // 크리인포는 가장 마지막: 전환 후 크뎀. 크확은 100% 가동 가정이라 가동률 계수는 없다.
  const critRate = cs.critRateTotal + (opts.critRateDelta ?? 0);
  const critDmg = us.critDmg + (cs.critReinforce ? critRate * 0.5 : 0);
  const critFactor = 1 + (BASE_CRIT_DMG + critDmg) / 100;
  const iedRemain = us.ignoreDef.reduce((a, v) => a * (1 - v / 100), 1); // ∏(1−vᵢ)
  const defFactor = Math.max(0, 1 - opts.bossDef * iedRemain);
  const finalFactor = us.finalDmg.reduce((a, v) => a * (1 + v / 100), 1);
  return statFactor(cs, us) * atk * dmgFactor * critFactor * defFactor * finalFactor;
}
