// StatBlock(stat-interface) ↔ UserStat 변환의 단일 통로.
// StatBlock은 소스별 진실 원천(한글 키·희소), UserStat은 계산용 누적 버킷 — 두 표현의 결합 규칙을 여기서만 안다.
import type { StatBlock, CharacterStats } from './stat-interface.js';
import { emptyUserStat, type UserStat, type MainStat } from './statSheet.js';

export const MAIN: MainStat[] = ['STR', 'DEX', 'INT', 'LUK'];

type Rec = Record<string, number | number[]>;

// UserStat → StatBlock (0인 필드는 생략)
export function toBlock(u: UserStat): StatBlock {
  const b: Rec = {};
  for (const k of MAIN) if (u.flat[k]) b[k] = u.flat[k];
  for (const k of MAIN) if (u.flatNoPct[k]) b[`${k}미적용`] = u.flatNoPct[k];
  for (const k of MAIN) if (u.pct[k]) b[`${k}%`] = u.pct[k];
  if (u.allFlat) b['올스탯'] = u.allFlat;
  if (u.allPct) b['올스탯%'] = u.allPct;
  if (u.atk) b['공격력'] = u.atk;
  if (u.matk) b['마력'] = u.matk;
  if (u.atkPct) b['공격력%'] = u.atkPct;
  if (u.matkPct) b['마력%'] = u.matkPct;
  if (u.damage) b['데미지'] = u.damage;
  if (u.bossDmg) b['보공'] = u.bossDmg;
  if (u.statusDmg) b['추가뎀'] = u.statusDmg;
  if (u.ignoreDef.length) b['방무'] = u.ignoreDef;
  if (u.finalDmg.length) b['최종뎀'] = u.finalDmg;
  if (u.critRate) b['크확'] = u.critRate;
  if (u.critDmg) b['크뎀'] = u.critDmg;
  if (u.hpFlat) b['HP'] = u.hpFlat;
  if (u.hpFlatNoPct) b['HP미적용'] = u.hpFlatNoPct;
  if (u.hpPct) b['HP%'] = u.hpPct;
  return b as StatBlock;
}

export const isEmptyBlock = (b: StatBlock): boolean => Object.keys(b).length === 0;

// 수집 파서(UserStat 뮤테이터)를 소스 단위로 돌려 StatBlock으로 뽑는다.
export function blockOf(fn: (u: UserStat) => void): StatBlock {
  const u = emptyUserStat();
  fn(u);
  return toBlock(u);
}

// StatBlock → UserStat 가산. 레벨당X는 인터페이스 규약(9레벨 주기)대로 floor(level/9)×M.
export function addBlock(u: UserStat, b: StatBlock, level: number): void {
  const r = b as Rec;
  for (const k of MAIN) {
    u.flat[k] += (r[k] as number) ?? 0;
    u.flatNoPct[k] += (r[`${k}미적용`] as number) ?? 0;
    u.pct[k] += (r[`${k}%`] as number) ?? 0;
    u.flat[k] += Math.floor(level / 9) * ((r[`레벨당${k}`] as number) ?? 0);
    u.flatNoPct[k] += (r['올스탯미적용'] as number) ?? 0;
  }
  u.allFlat += (r['올스탯'] as number) ?? 0;
  u.allPct += (r['올스탯%'] as number) ?? 0;
  u.atk += (r['공격력'] as number) ?? 0;
  u.matk += (r['마력'] as number) ?? 0;
  u.atkPct += (r['공격력%'] as number) ?? 0;
  u.matkPct += (r['마력%'] as number) ?? 0;
  u.damage += (r['데미지'] as number) ?? 0;
  u.bossDmg += (r['보공'] as number) ?? 0;
  u.statusDmg += (r['추가뎀'] as number) ?? 0;
  u.ignoreDef.push(...((r['방무'] as number[]) ?? []));
  u.finalDmg.push(...((r['최종뎀'] as number[]) ?? []));
  u.critRate += (r['크확'] as number) ?? 0;
  u.critDmg += (r['크뎀'] as number) ?? 0;
  u.hpFlat += (r['HP'] as number) ?? 0;
  u.hpFlatNoPct += (r['HP미적용'] as number) ?? 0;
  u.hpPct += (r['HP%'] as number) ?? 0;
}

// 교체 계산용 부호 반전. 가산 필드는 −v, 곱연산(방무·최종뎀)은 정확한 역수 계수로.
// 방무 100%는 역수가 없어(0으로 나눔) 제거 불가 — 현실에 없는 값이라 스킵.
export function negateBlock(b: StatBlock): StatBlock {
  const out: Rec = {};
  for (const [k, v] of Object.entries(b as Rec)) {
    if (k === '방무') out[k] = (v as number[]).filter((x) => x !== 100).map((x) => 100 * (1 - 1 / (1 - x / 100)));
    else if (k === '최종뎀') out[k] = (v as number[]).map((x) => 100 * (1 / (1 + x / 100) - 1));
    else out[k] = -(v as number);
  }
  return out as StatBlock;
}

// StatBlock(값이 number|number[]) vs 블록 묶음(값이 객체) 판별. 빈 객체는 어느 쪽으로 봐도 무해.
const isBlock = (v: object): boolean =>
  Object.values(v).every((x) => typeof x === 'number' || Array.isArray(x));

// CharacterStats 전체 → UserStat. 소스 구조(단일 블록/블록 묶음)를 모양으로 판별해 전부 가산한다.
// 메이플용사(N%)는 "직접 찍은 스탯"=AP 블록의 주스탯 × N%를 깡(flat)으로 환산(floor, 스탯별 개별 내림).
// 크리티컬리인포스는 스탯 합산이 아니라 D 계산 최종 단계의 전환이라 여기서 다루지 않는다(combat.ts).
export function flattenStats(cs: CharacterStats, level: number): UserStat {
  const us = emptyUserStat();
  for (const v of Object.values(cs)) {
    if (v == null || typeof v === 'number') continue;
    if (isBlock(v)) addBlock(us, v as StatBlock, level);
    else for (const b of Object.values(v as Record<string, StatBlock>)) addBlock(us, b, level);
  }
  if (cs.메이플용사) {
    const ap = cs.AP as Rec;
    for (const k of MAIN) us.flat[k] += Math.floor((((ap[k] as number) ?? 0) * cs.메이플용사) / 100);
  }
  return us;
}
