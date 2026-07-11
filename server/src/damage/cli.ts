// 스탯 수집 진단 CLI — 1회 실측: pnpm tsx server/src/damage/cli.ts [닉네임]
// 전 소스를 모아 UserStat + 소스별 주스탯 기여 + 재구성 대조를 출력한다.
// 넥슨 API 원본은 디스크에 캐시(.nexon-raw-<닉>.json) — 재실행 시 API를 다시 쏘지 않고 재집계만 한다.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fetchCharacterRaw, aggregateCharacter, type RawBundle } from './nexon.js';
import { emptyUserStat, type UserStat, type MainStat } from './statSheet.js';
import { collectGear, collectSet, collectSymbol, collectHyper, collectAbility, collectBaseAP, collectUnion, collectArtifact, collectTitle, collectMapleWarrior } from './collect.js';
import { collectSkillPassive } from './skillPassive.js';
import { collectLinkSkills } from './linkSkill.js';
import { collectHexaStat } from './hexaStat.js';

if (!process.env.NEXON_DEVELOPER_KEY) {
  try {
    const env = readFileSync(new URL('../../../.env', import.meta.url), 'utf8');
    for (const line of env.split('\n')) {
      const i = line.indexOf('=');
      if (i > 0 && !line.startsWith('#')) process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  } catch { /* .env 없으면 무시 */ }
}

const name = process.argv[2] ?? '오유찬';
const dumpPath = new URL(`../../../.nexon-raw-${name}.json`, import.meta.url);
let bundle: RawBundle; let fetchWarnings: string[];
if (existsSync(dumpPath)) {
  ({ raw: bundle, warnings: fetchWarnings } = JSON.parse(readFileSync(dumpPath, 'utf8')));
  console.log(`(디스크 캐시 사용: .nexon-raw-${name}.json — API 미호출)`);
} else {
  ({ raw: bundle, warnings: fetchWarnings } = await fetchCharacterRaw(name));
  writeFileSync(dumpPath, JSON.stringify({ raw: bundle, warnings: fetchWarnings }));
  console.log(`(넥슨 API 조회 → .nexon-raw-${name}.json 저장)`);
}
const { final, userStat: us, warnings, raw } = aggregateCharacter(name, bundle, fetchWarnings);

if (warnings.length) console.log('⚠️  누락 소스:', warnings.join(' | '));
console.log(`\n[${name}] ${final.characterClass} Lv.${final.level}`);
console.log('API 최종 주스탯:', final.finalMain, '| 스탯공격력', final.statAtkMin, '~', final.statAtkMax);

// 소스별 전 버킷 기여 분해
const MAIN: MainStat[] = ['STR', 'DEX', 'INT', 'LUK'];
const level = Number(bundle.basic?.character_level ?? 0);
const mainOf = (fn: (u: UserStat) => void) => { const u = emptyUserStat(); fn(u); return u; };
const src: [string, UserStat][] = [
  ['baseAP', mainOf((u) => collectBaseAP(u, raw.statMap))],
  ['메용', mainOf((u) => collectMapleWarrior(u, raw.statMap, raw.skills ?? {}))],
  ['gear', mainOf((u) => raw.equip && collectGear(u, raw.equip.item_equipment, level))],
  ['title', mainOf((u) => raw.equip && collectTitle(u, raw.equip))],
  ['set', mainOf((u) => raw.setEff && collectSet(u, raw.setEff.set_effect))],
  ['symbol', mainOf((u) => raw.symbol && collectSymbol(u, raw.symbol.symbol))],
  ['hyper', mainOf((u) => raw.hyper && collectHyper(u, raw.hyper[`hyper_stat_preset_${raw.hyper.use_preset_no ?? 1}`]))],
  ['ability', mainOf((u) => raw.ability && collectAbility(u, raw.ability.ability_info))],
  ['link', mainOf((u) => bundle.link && collectLinkSkills(u, bundle.link))],
  ['union', mainOf((u) => raw.union && collectUnion(u, raw.union))],
  ['artifact', mainOf((u) => bundle.artifact && collectArtifact(u, bundle.artifact))],
  ['skill', mainOf((u) => collectSkillPassive(u, raw.class, raw.skills ?? {}))],
  ['hexa', mainOf((u) => raw.hexa && collectHexaStat(u, raw.hexa, raw.mainKey, raw.mainKey === 'INT', raw.class === '제논' ? 'xenon' : raw.class === '데몬어벤져' ? 'deven' : 'normal'))],
];
const fmtAll = (u: UserStat): string => {
  const p: string[] = [];
  for (const k of MAIN) if (u.flat[k] || u.flatNoPct[k] || u.pct[k]) p.push(`${k} f+${u.flat[k]} nf+${u.flatNoPct[k]} p+${u.pct[k]}`);
  if (u.allFlat) p.push(`올f+${u.allFlat}`); if (u.allPct) p.push(`올%+${u.allPct}`);
  if (u.atk) p.push(`공+${u.atk}`); if (u.matk) p.push(`마+${u.matk}`);
  if (u.atkPct) p.push(`공%+${u.atkPct}`); if (u.matkPct) p.push(`마%+${u.matkPct}`);
  if (u.damage) p.push(`뎀+${u.damage}`); if (u.bossDmg) p.push(`보공+${u.bossDmg}`);
  if (u.ignoreDef.length) p.push(`방무[${u.ignoreDef.join(',')}]`);
  if (u.finalDmg.length) p.push(`최종[${u.finalDmg.join(',')}]`);
  if (u.critRate) p.push(`크확+${u.critRate}`); if (u.critDmg) p.push(`크뎀+${u.critDmg}`);
  if (u.hpFlat || u.hpFlatNoPct || u.hpPct) p.push(`HP f+${u.hpFlat} nf+${u.hpFlatNoPct} p+${u.hpPct}`);
  return p.join(', ') || '-';
};
console.log('\n── 소스별 기여 (전 버킷) ──');
for (const [label, u] of src) console.log(`  ${label.padEnd(8)}: ${fmtAll(u)}`);

// 부위별 gear 주스탯% 분해 (버그 헌팅)
console.log('\n── 장비별 LUK%/올스탯% 기여 ──');
for (const it of raw.equip?.item_equipment ?? []) {
  const u = emptyUserStat();
  collectGear(u, [it]);
  if (u.pct.LUK || u.allPct || u.flat.LUK) {
    const lines = ['potential_option_1', 'potential_option_2', 'potential_option_3', 'additional_potential_option_1', 'additional_potential_option_2', 'additional_potential_option_3'].map((k) => it[k]).filter(Boolean);
    console.log(`  ${it.item_equipment_slot?.padEnd(6)}: LUKflat+${u.flat.LUK} LUK%+${u.pct.LUK} 올%+${u.allPct}  | 잠재/에디: ${lines.join(' / ')}`);
  }
}

console.log('\n── 재구성 vs API (주스탯) ──  [(flat+올flat)×(1+(pct+올pct)/100)+flatNoPct]');
for (const k of MAIN) {
  const recon = Math.floor((us.flat[k] + us.allFlat) * (1 + (us.pct[k] + us.allPct) / 100)) + us.flatNoPct[k];
  const gap = recon - final.finalMain[k];
  console.log(`  ${k}: 재구성 ${recon} vs API ${final.finalMain[k]}  → 잔차 ${gap > 0 ? '+' : ''}${gap}  (flat ${us.flat[k]}+올${us.allFlat}, pct ${us.pct[k]}+올${us.allPct})`);
}

// ── 주스탯 외 잔차: 공/마·데미지·보공·방무·크확·크뎀 ──
// 방무는 곱연산: 100×(1−∏(1−v/100)). 나머지는 가산. 베이스(직업 기본 크확 5% 등)는 잔차로 드러나면 유저 확인.
console.log('\n── 재구성 vs API (공·데미지 계열) ──');
const m = final.raw;
const round2 = (v: number) => Math.round(v * 100) / 100;
const iedRecon = round2(100 * (1 - us.ignoreDef.reduce((a, v) => a * (1 - v / 100), 1)));
const rows: [string, number, number][] = [
  ['공격력', us.atk, m['공격력'] ?? 0],           // API 공격력은 최종값 — % 적용식은 잔차 보고 확정
  ['마력', us.matk, m['마력'] ?? 0],
  ['공격력%수집', us.atkPct, NaN],                 // 참고 출력(API에 직접 대응값 없음)
  ['데미지', round2(us.damage), m['데미지'] ?? 0],
  ['보스 몬스터 데미지', round2(us.bossDmg), m['보스 몬스터 데미지'] ?? 0],
  ['방어율 무시', iedRecon, m['방어율 무시'] ?? 0],
  ['크리티컬 확률', us.critRate, m['크리티컬 확률'] ?? 0],
  ['크리티컬 데미지', round2(us.critDmg), m['크리티컬 데미지'] ?? 0],
  ['최종 데미지', round2(100 * (us.finalDmg.reduce((a, v) => a * (1 + v / 100), 1) - 1)), m['최종 데미지'] ?? 0],
];
for (const [label, recon, api] of rows) {
  if (Number.isNaN(api)) { console.log(`  ${label}: 수집 ${recon} (API 대응값 없음 — 참고)`); continue; }
  const gap = round2(recon - api);
  console.log(`  ${label}: 재구성 ${recon} vs API ${api}  → 잔차 ${gap > 0 ? '+' : ''}${gap}`);
}
process.exit(0);
