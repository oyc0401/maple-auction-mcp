import type { UserStat, MainStat } from './statSheet.js';

const STAT_ALIAS: Record<string, MainStat> = {
  STR: 'STR', DEX: 'DEX', INT: 'INT', LUK: 'LUK',
  '힘': 'STR', '민첩': 'DEX', '지력': 'INT', '운': 'LUK',
  '민첩성': 'DEX', '지능': 'INT', '행운': 'LUK',
};

export function apply(us: UserStat, name: string, val: number, pct: boolean, noPct = false): void {
  if (name.includes(',')) { for (const part of name.split(',')) apply(us, part, val, pct, noPct); return; }
  const n = name.trim();
  const main = STAT_ALIAS[n];
  if (main) {
    if (pct) us.pct[main] += val;
    else if (noPct) us.flatNoPct[main] += val;
    else us.flat[main] += val;
    return;
  }
  switch (n) {
    case '올스탯':
      if (pct) us.allPct += val;
      else if (noPct) { for (const k of ['STR', 'DEX', 'INT', 'LUK'] as MainStat[]) us.flatNoPct[k] += val; }
      else us.allFlat += val;
      break;
    case '최대 HP': pct ? (us.hpPct += val) : (noPct ? (us.hpFlatNoPct += val) : (us.hpFlat += val)); break;
    case '공격력': pct ? (us.atkPct += val) : (us.atk += val); break;
    case '마력': pct ? (us.matkPct += val) : (us.matk += val); break;
    case '공격력과 마력':
    case '공격력/마력':
      if (pct) { us.atkPct += val; us.matkPct += val; } else { us.atk += val; us.matk += val; } break;
    case '데미지': if (pct) us.damage += val; break;
    case '추가뎀':
    case '상태 이상에 걸린 대상 공격 시 데미지':
    case '상태 이상에 걸린 몬스터 공격 시 데미지':
      if (pct) us.statusDmg += val; break;
    case '보스 몬스터 데미지':
    case '보스 데미지':
    case '보스 몬스터 공격 시 데미지':
    case '보스 몬스터 공격 시 데미지 증가': if (pct) us.bossDmg += val; break;
    case '몬스터 방어율 무시':
    case '방어율 무시': if (pct) us.ignoreDef.push(val); break;
    case '최종 데미지': if (pct) us.finalDmg.push(val); break;
    case '크리티컬 확률': if (pct) us.critRate += val; break;
    case '크리티컬 데미지': if (pct) us.critDmg += val; break;
    default: break;
  }
}

const RE_PLUS = /^(.+?)\s*\+\s*(-?\d+(?:\.\d+)?)\s*(%?)$/;
export function accumPlus(us: UserStat, line: string | null | undefined, noPct = false): void {
  if (!line) return;
  for (const seg of line.split(',')) {
    const m = seg.trim().match(RE_PLUS);
    if (!m) continue;
    apply(us, m[1], Number(m[2]), m[3] === '%', noPct);
  }
}

const RE_INC = /^(.+?)\s+(-?\d+(?:\.\d+)?)\s*(%?)\s*증가$/;
const RE_INC_SEG = /^(.+?)\s*(-?\d+(?:\.\d+)?)\s*(%?)(?:\s*증가)?$/;
export function accumIncrease(us: UserStat, line: string | null | undefined, noPct = false): void {
  if (!line) return;
  const segs = line.split(',').map((s) => s.trim());
  if (segs.length > 1 && segs.every((s) => /\d/.test(s))) {
    for (const seg of segs) {
      const m = seg.match(RE_INC_SEG);
      if (m) apply(us, m[1], Number(m[2]), m[3] === '%', noPct);
    }
    return;
  }
  const m = line.trim().match(RE_INC);
  if (!m) return;
  apply(us, m[1], Number(m[2]), m[3] === '%', noPct);
}
