// 넥슨 오픈 API의 옵션 텍스트를 UserStat 버킷에 누적하는 파서.
// 두 포맷을 처리한다:
//   A) "이름 +값[%]"        — 장비 잠재/에디, 세트 옵션 (콤마 다중, 예 "공격력  +30, 보스 몬스터 데미지 +10%")
//   B) "이름 값[%] 증가"    — 하이퍼스탯 stat_increase, 어빌, 유니온 (예 "운 180 증가", "크리티컬 확률 8% 증가")
import type { UserStat, MainStat } from './statSheet.js';

// 한글 스탯명 → 버킷 키. 하이퍼/유니온은 힘·민첩·지력·운 표기.
const STAT_ALIAS: Record<string, MainStat> = {
  STR: 'STR', DEX: 'DEX', INT: 'INT', LUK: 'LUK',
  '힘': 'STR', '민첩': 'DEX', '지력': 'INT', '운': 'LUK',
  '민첩성': 'DEX', '지능': 'INT', '행운': 'LUK', // 스킬 텍스트 변형 표기
};

// 옵션명 하나 + 수치 + 퍼센트여부를 버킷에 싣는다. 환산 무관 옵션은 조용히 무시.
// noPct=true면 깡 주스탯/올스탯/HP를 "스탯% 안 받는" 버킷으로 보낸다(심볼·하이퍼·유니온 공격대원효과).
export function apply(us: UserStat, name: string, val: number, pct: boolean, noPct = false): void {
  // "STR, DEX, LUK" 처럼 한 값이 여러 스탯에 걸리는 결합 표기 → 각 스탯에 동일 val 적용 (유니온 등).
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
    case '공격력과 마력': // 하이퍼스탯 "공격력과 마력 N 증가"
    case '공격력/마력':   // 유니온 "공격력/마력 N 증가"
      if (pct) { us.atkPct += val; us.matkPct += val; } else { us.atk += val; us.matk += val; } break;
    case '데미지': if (pct) us.damage += val; break;
    case '보스 몬스터 데미지':
    case '보스 데미지':
    case '보스 몬스터 공격 시 데미지':
    case '보스 몬스터 공격 시 데미지 증가': if (pct) us.bossDmg += val; break;
    case '몬스터 방어율 무시':
    case '방어율 무시': if (pct) us.ignoreDef.push(val); break;
    case '최종 데미지': if (pct) us.finalDmg.push(val); break;
    case '크리티컬 확률': if (pct) us.critRate += val; break;
    case '크리티컬 데미지': if (pct) us.critDmg += val; break;
    default: break; // 상태이상내성·버프지속·재사용대기 등 환산 무관
  }
}

// 포맷 A: "이름 +값[%]" (콤마 다중). 이름에 콤마가 있으면 여러 스탯 동시(예 "STR, DEX +36").
const RE_PLUS = /^(.+?)\s*\+\s*(-?\d+(?:\.\d+)?)\s*(%?)$/;
export function accumPlus(us: UserStat, line: string | null | undefined, noPct = false): void {
  if (!line) return;
  for (const seg of line.split(',')) {
    const m = seg.trim().match(RE_PLUS);
    if (!m) continue;
    apply(us, m[1], Number(m[2]), m[3] === '%', noPct);
  }
}

// 포맷 B: "이름 값[%] 증가" (하이퍼 stat_increase / 어빌 ability_value / 유니온 / 아티팩트).
// 콤마 결합이 두 가지라 구분한다:
//   공유값형 "STR, DEX, LUK 50 증가"   → 이름에 콤마 → apply()가 분배 (숫자 없는 세그먼트 존재)
//   개별값형 "공격력 30, 마력 30 증가" → 세그먼트마다 숫자 → 각각 파싱 (마지막만 "증가"로 끝남)
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
