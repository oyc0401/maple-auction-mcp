// 6차 HEXA 스탯 코어 → UserStat. /character/hexamatrix-stat.
// 코어마다 메인 스탯 1 + 부가 스탯 2, 각 레벨(1~10). 스탯 종류·레벨 → 수치는 아래 표(유저 제공).
// 표: 메인 슬롯은 MAIN, 부가 슬롯은 SUB. 열 = 크뎀/보스/방무/데미지/공마/주스탯.
// 'main'(주력 스탯) 열은 직업별로 값이 다르다: 일반=주스탯, 제논=올스탯(괄호 1번째), 데벤=MAX HP(괄호 2번째).
import type { UserStat, MainStat } from './statSheet.js';

export type JobKind = 'normal' | 'xenon' | 'deven';
type Col = 'critDmg' | 'boss' | 'ied' | 'damage' | 'atk' | 'main';
// Lv1..10 (인덱스 0..9)
const MAIN: Record<Col, number[]> = {
  critDmg: [0.35, 0.7, 1.05, 1.4, 2.1, 2.8, 3.5, 4.55, 5.6, 7],
  boss:    [1, 2, 3, 4, 6, 8, 10, 13, 16, 20],
  ied:     [1, 2, 3, 4, 6, 8, 10, 13, 16, 20],
  damage:  [0.75, 1.5, 2.25, 3, 4.5, 6, 7.5, 9.75, 12, 15],
  atk:     [5, 10, 15, 20, 30, 40, 50, 65, 80, 100],
  main:    [100, 200, 300, 400, 600, 800, 1000, 1300, 1600, 2000], // 일반직업 주스탯
};
const MAIN_XENON = [48, 96, 144, 192, 288, 384, 480, 624, 768, 960];        // 제논 올스탯
const MAIN_DEVEN = [2100, 4200, 6300, 8400, 12600, 16800, 21000, 27300, 33600, 42000]; // 데벤 MAX HP
const SUB: Record<Col, number[]> = {
  critDmg: [0.35, 0.7, 1.05, 1.4, 1.75, 2.1, 2.45, 2.8, 3.15, 3.5],
  boss:    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  ied:     [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  damage:  [0.75, 1.5, 2.25, 3, 3.75, 4.5, 5.25, 6, 6.75, 7.5],
  atk:     [5, 10, 15, 20, 25, 30, 35, 40, 45, 50],
  main:    [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000], // 일반직업 주스탯
};
const SUB_XENON = [48, 96, 144, 192, 240, 288, 336, 384, 432, 480];
const SUB_DEVEN = [2100, 4200, 6300, 8400, 10500, 12600, 14700, 16800, 18900, 21000];

// 코어 스탯 이름 → 열
function colOf(name: string | null | undefined): Col | null {
  if (!name) return null;
  if (name.includes('주력 스탯')) return 'main';
  if (name.includes('크리티컬 데미지')) return 'critDmg';
  if (name.includes('보스 데미지')) return 'boss';
  if (name.includes('방어율 무시')) return 'ied';
  if (name.includes('공격력') || name.includes('마력')) return 'atk';
  if (name.includes('데미지')) return 'damage'; // '보스/크리티컬 데미지'는 위에서 선점
  return null;
}

interface Ctx { mainKey: MainStat; isMagic: boolean; job: JobKind }

function addCol(us: UserStat, col: Col, lv: number, isMain: boolean, ctx: Ctx): void {
  const tbl = isMain ? MAIN : SUB;
  if (col === 'main') {
    // 주력 스탯 열: HEXA 주스탯은 스탯% 안 받음(abs) → flatNoPct. 직업별 분기.
    if (ctx.job === 'xenon') { const v = (isMain ? MAIN_XENON : SUB_XENON)[lv - 1] ?? 0; for (const k of ['STR', 'DEX', 'INT', 'LUK'] as MainStat[]) us.flatNoPct[k] += v; }
    else if (ctx.job === 'deven') us.hpFlatNoPct += (isMain ? MAIN_DEVEN : SUB_DEVEN)[lv - 1] ?? 0;
    else us.flatNoPct[ctx.mainKey] += tbl.main[lv - 1] ?? 0;
    return;
  }
  const val = tbl[col][lv - 1] ?? 0;
  switch (col) {
    case 'atk': ctx.isMagic ? (us.matk += val) : (us.atk += val); break;
    case 'boss': us.bossDmg += val; break;
    case 'ied': us.ignoreDef.push(val); break;
    case 'damage': us.damage += val; break;
    case 'critDmg': us.critDmg += val; break;
  }
}

export function collectHexaStat(us: UserStat, hexa: any, mainKey: MainStat, isMagic: boolean, job: JobKind = 'normal'): void {
  const ctx: Ctx = { mainKey, isMagic, job };
  // 헥사 스탯 코어는 최대 3개(core, core_2, core_3) — 장착분 전부 합산. preset_* 는 미장착 프리셋이라 제외.
  for (const field of ['character_hexa_stat_core', 'character_hexa_stat_core_2', 'character_hexa_stat_core_3']) {
    for (const c of hexa?.[field] ?? []) {
      const m = colOf(c.main_stat_name);
      if (m) addCol(us, m, Number(c.main_stat_level), true, ctx);
      const s1 = colOf(c.sub_stat_name_1);
      if (s1) addCol(us, s1, Number(c.sub_stat_level_1), false, ctx);
      const s2 = colOf(c.sub_stat_name_2);
      if (s2) addCol(us, s2, Number(c.sub_stat_level_2), false, ctx);
    }
  }
}
