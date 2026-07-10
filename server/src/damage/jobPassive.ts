// 직업별 스킬 패시브가 resting 스탯(넥슨 final_stat)에 주는 기여.
// 정책(유저 합의):
//   - 1~4차 패시브 + 하이퍼 패시브: 모두 만렙 가정, 직업별 상수로 하드코딩(스킬 파싱 안 함).
//     4차 이하는 캐릭마다 값이 같고, 스킬 문구는 직업마다 구조가 달라 일반 파싱이 위험하기 때문.
//   - 0차(공통 beginner) 스킬: /character/skill 파싱 (skillPassive.ts).
//   - 5차·6차(HEXA) 패시브: 캐릭터마다 레벨/코어가 달라 /character/skill 파싱 (skillPassive.ts).
// 담는 값: 항상 켜져 있는(무조건) 패시브.
// ⚠️ 조건부·확률발동·소환수·액티브에 붙은 효과는 "자동 제외" 금지 — 상시유지로 보는 경우가 많고 아닌 것도 많다.
//    이런 항목은 반드시 유저(도메인 전문가)에게 "상시유지로 볼까요?" 확인받고 반영한다.
import type { UserStat, MainStat } from './statSheet.js';

export interface JobPassive {
  flat?: Partial<Record<MainStat, number>>; // 깡 주스탯 (스탯% 적용 대상)
  flatNoPct?: Partial<Record<MainStat, number>>; // 스탯% 안 받는 깡 주스탯
  pct?: Partial<Record<MainStat, number>>;  // 주스탯 %
  allPct?: number;
  atk?: number; matk?: number; atkPct?: number; matkPct?: number;
  damage?: number; bossDmg?: number;
  ignoreDef?: number[]; finalDmg?: number[];
  critRate?: number; critDmg?: number;
  note?: string; // 출처 스킬명 메모
}

// 직업 → 무조건 패시브 합. 카데나부터. 값은 실측 재구성으로 채운다(추정치는 note에 표기).
export const JOB_PASSIVES: Record<string, JobPassive> = {
  // 카데나: 스킬 패시브 기여. TODO 실측 확인 — 현재는 재구성 잔차로 좁혀가는 중.
  '카데나': {
    note: '작성 중 — 스킬 패시브 실측 반영 예정',
  },
};

export function collectJobPassive(us: UserStat, job: string): void {
  const p = JOB_PASSIVES[job];
  if (!p) return;
  const addMain = (dst: Record<MainStat, number>, src?: Partial<Record<MainStat, number>>) => {
    if (!src) return;
    for (const k of ['STR', 'DEX', 'INT', 'LUK'] as MainStat[]) dst[k] += src[k] ?? 0;
  };
  addMain(us.flat, p.flat);
  addMain(us.flatNoPct, p.flatNoPct);
  addMain(us.pct, p.pct);
  us.allPct += p.allPct ?? 0;
  us.atk += p.atk ?? 0; us.matk += p.matk ?? 0;
  us.atkPct += p.atkPct ?? 0; us.matkPct += p.matkPct ?? 0;
  us.damage += p.damage ?? 0; us.bossDmg += p.bossDmg ?? 0;
  us.critRate += p.critRate ?? 0; us.critDmg += p.critDmg ?? 0;
  if (p.ignoreDef) us.ignoreDef.push(...p.ignoreDef);
  if (p.finalDmg) us.finalDmg.push(...p.finalDmg);
}
