// 스탯 수집 진단 CLI — 1회 실측: pnpm tsx server/src/damage/cli.ts [닉네임]
// 전 소스를 모아 UserStat + 소스별 주스탯 기여 + 재구성 대조를 출력한다.
import { readFileSync } from 'node:fs';
import { collectCharacter } from './nexon.js';
import { emptyUserStat, type UserStat, type MainStat } from './statSheet.js';
import { collectGear, collectSet, collectSymbol, collectHyper, collectAbility, collectBaseAP, collectUnion } from './collect.js';
import { collectSkillPassive } from './skillPassive.js';
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
const { final, userStat: us, warnings, raw } = await collectCharacter(name);

if (warnings.length) console.log('⚠️  누락 소스:', warnings.join(' | '));
console.log(`\n[${name}] ${final.characterClass} Lv.${final.level}`);
console.log('API 최종 주스탯:', final.finalMain, '| 스탯공격력', final.statAtkMin, '~', final.statAtkMax);

// 소스별 주스탯(flat/pct) 기여 분해
const MAIN: MainStat[] = ['STR', 'DEX', 'INT', 'LUK'];
const mainOf = (fn: (u: UserStat) => void) => { const u = emptyUserStat(); fn(u); return u; };
const src: [string, UserStat][] = [
  ['baseAP', mainOf((u) => collectBaseAP(u, raw.statMap))],
  ['gear', mainOf((u) => raw.equip && collectGear(u, raw.equip.item_equipment))],
  ['set', mainOf((u) => raw.setEff && collectSet(u, raw.setEff.set_effect))],
  ['symbol', mainOf((u) => raw.symbol && collectSymbol(u, raw.symbol.symbol))],
  ['hyper', mainOf((u) => raw.hyper && collectHyper(u, raw.hyper[`hyper_stat_preset_${raw.hyper.use_preset_no ?? 1}`]))],
  ['ability', mainOf((u) => raw.ability && collectAbility(u, raw.ability.ability_info))],
  ['union', mainOf((u) => raw.union && collectUnion(u, raw.union))],
  ['skill', mainOf((u) => collectSkillPassive(u, raw.class, raw.skills ?? {}))],
  ['hexa', mainOf((u) => raw.hexa && collectHexaStat(u, raw.hexa, raw.mainKey, raw.mainKey === 'INT', raw.class === '제논' ? 'xenon' : raw.class === '데몬어벤져' ? 'deven' : 'normal'))],
];
console.log('\n── 소스별 주스탯 기여 (flat / flatNoPct / pct) ──');
for (const [label, u] of src) {
  const parts = MAIN.filter((k) => u.flat[k] || u.flatNoPct[k] || u.pct[k]).map((k) => `${k} f+${u.flat[k]} nf+${u.flatNoPct[k]} p+${u.pct[k]}`);
  const extra = [u.allFlat && `올f+${u.allFlat}`, u.allPct && `올%+${u.allPct}`].filter(Boolean);
  console.log(`  ${label.padEnd(8)}: ${[...parts, ...extra].join(', ') || '-'}`);
}

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
process.exit(0);
