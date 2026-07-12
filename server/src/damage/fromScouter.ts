// maplescouter ScouterUserStat(resting 스탯 집계) → 우리 계산 버킷 UserStat + CombatStats.
// 용도: 브라우저로 캡처한 /api/id 의 userStat 을 넥슨 재구성 없이 바로 combat.ts 계산에 태워
//       "기존 + 스탯 → 데미지 증감률"을 낸다.
//
// 매핑 근거(오유찬 실측):
//   mainStatBase(스탯% 적용 깡) ↔ flat[main]+allFlat  → 올스탯은 축별 base/per 에 이미 접혀 오므로
//     allFlat/allPct=0 으로 두고 축별로만 채운다(계산 결과 동일). mainStatPer ↔ pct[main]+allPct, mainStatAbs ↔ flatNoPct[main].
//   atkBase ↔ us.atk (무기공 포함). weaponAtk 는 maplescouter 별도 필드일 뿐 D 공식 미사용.
//   ignoreDef 는 이미 합산된 방무%(단일값) → ∏ 계산에 1원소 배열로 넣으면 동치.
//   criticalDmg 는 기본 35·크리티컬 리인포스 전환까지 반영된 총 크뎀 → critReinforcePct=0 으로 둔다.
//
// 손실 주의:
//   - 최종뎀(∏(1+v/100)): ScouterUserStat 에 필드가 없어 finalDmg=[]. 증감률에선 베이스 최종뎀이
//     상쇄돼 무해하나, 절대 D 는 그 배수만큼 작다.
//   - 크리티컬 리인포스 보유 여부가 유실됨(크뎀에 이미 접혀 옴). 델타로 "크확"을 더할 때 리인포스
//     추가 전환이 반영되지 않는다. 고스펙(크확 100%↑)은 어차피 크확 증가가 무의미해 실사용 영향 미미.
import type { ScouterUserStat } from '../scouter/dmgSimulatorPayload.js';
import { emptyUserStat, type UserStat, type MainStat } from './statSheet.js';
import { statAxesOf, type CombatStats } from './combat.js';

// ScouterUserStat → UserStat. 순수 데이터 변환(넥슨 호출 없음).
export function scouterToUserStat(su: ScouterUserStat): UserStat {
  const u = emptyUserStat();
  const s = su.stat;
  const e = su.entireStat;
  const axes = statAxesOf(s.myClass, { STR: e.str, DEX: e.dex, INT: e.int, LUK: e.luk });

  const put = (k: MainStat, base: number, per: number, abs: number) => {
    u.flat[k] = base; u.pct[k] = per; u.flatNoPct[k] = abs;
  };
  if (axes.kind === 'standard') {
    put(axes.main, s.mainStatBase, s.mainStatPer, s.mainStatAbs);
    put(axes.sub, s.subStatBase, s.subStatPer, s.subStatAbs);
    if (axes.ssub) put(axes.ssub, s.ssubStatBase, s.ssubStatPer, s.ssubStatAbs);
  } else {
    // 제논(3스탯 합)·데몬어벤져(HP축)는 combat.ts 에서도 미검증 — main/sub 만 근사로 싣는다.
    put('STR', s.mainStatBase, s.mainStatPer, s.mainStatAbs);
    put('DEX', s.subStatBase, s.subStatPer, s.subStatAbs);
  }

  const magic = axes.kind === 'standard' && axes.isMagic;
  if (magic) { u.matk = s.atkBase; u.matkPct = s.atkPercent; }
  else { u.atk = s.atkBase; u.atkPct = s.atkPercent; }

  u.damage = s.dmg;
  u.bossDmg = s.bossDmg;
  u.statusDmg = s.statusAdditionalDmg;
  u.critRate = s.critical;
  u.critDmg = s.criticalDmg;                 // 기본 35·크리인포 전환 이미 포함
  if (s.ignoreDef) u.ignoreDef = [s.ignoreDef]; // 합산 방무% → 1원소 배열(∏ 동치)
  // finalDmg 는 ScouterUserStat 에 없음 → []. 증감률에선 베이스 최종뎀이 상쇄돼 무해.
  return u;
}

// ScouterUserStat → CombatStats(damageOf 입력). 넥슨 CharacterCollected 없이 계산 가능.
// critReinforcePct=0: criticalDmg 에 리인포스 전환이 이미 접혀 있으므로 재적용하지 않는다.
export function combatStatsFromScouter(su: ScouterUserStat): CombatStats {
  const us = scouterToUserStat(su);
  const e = su.entireStat;
  const axes = statAxesOf(su.stat.myClass, { STR: e.str, DEX: e.dex, INT: e.int, LUK: e.luk });
  const notes: string[] = [];
  if (axes.kind !== 'standard') notes.push('제논·데몬어벤져 축은 미검증 — 증감률 참고용');
  return {
    myClass: su.stat.myClass, level: su.stat.level, axes, us,
    critRateTotal: us.critRate, critReinforcePct: 0, notes,
  };
}
