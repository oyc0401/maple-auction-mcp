import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fetchCharacterRaw, aggregateCharacter, type RawBundle } from './nexon.js';
import { emptyUserStat, type UserStat } from './statSheet.js';
import type { StatBlock, CharacterStats } from './stat-interface.js';
import { addBlock, MAIN } from './block.js';

if (!process.env.NEXON_DEVELOPER_KEY) {
  try {
    const env = readFileSync(new URL('../../../.env', import.meta.url), 'utf8');
    for (const line of env.split('\n')) {
      const i = line.indexOf('=');
      if (i > 0 && !line.startsWith('#')) process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  } catch { /* ignore */ }
}

const name = process.argv[2];
if (!name) {
  console.error('사용법: pnpm tsx server/src/damage/cli.ts <닉네임>');
  process.exit(1);
}
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
const { final, stats, warnings } = aggregateCharacter(name, bundle, fetchWarnings);

if (warnings.length) console.log('⚠️  누락 소스:', warnings.join(' | '));
console.log(`\n[${name}] ${final.characterClass} Lv.${final.level}`);
console.log('API 최종 주스탯:', final.finalMain, '| 스탯공격력', final.statAtkMin, '~', final.statAtkMax);

const level = final.level;
const usOf = (blocks: StatBlock[]): UserStat => {
  const u = emptyUserStat();
  for (const b of blocks) addBlock(u, b, level);
  return u;
};
const fmtAll = (u: UserStat): string => {
  const p: string[] = [];
  for (const k of MAIN) if (u.flat[k] || u.flatNoPct[k] || u.pct[k]) p.push(`${k} f+${u.flat[k]} nf+${u.flatNoPct[k]} p+${u.pct[k]}`);
  if (u.allFlat) p.push(`올f+${u.allFlat}`); if (u.allPct) p.push(`올%+${u.allPct}`);
  if (u.atk) p.push(`공+${u.atk}`); if (u.matk) p.push(`마+${u.matk}`);
  if (u.atkPct) p.push(`공%+${u.atkPct}`); if (u.matkPct) p.push(`마%+${u.matkPct}`);
  if (u.damage) p.push(`뎀+${u.damage}`); if (u.bossDmg) p.push(`보공+${u.bossDmg}`);
  if (u.statusDmg) p.push(`추가뎀+${u.statusDmg}`);
  if (u.ignoreDef.length) p.push(`방무[${u.ignoreDef.join(',')}]`);
  if (u.finalDmg.length) p.push(`최종[${u.finalDmg.join(',')}]`);
  if (u.critRate) p.push(`크확+${u.critRate}`); if (u.critDmg) p.push(`크뎀+${u.critDmg}`);
  if (u.hpFlat || u.hpFlatNoPct || u.hpPct) p.push(`HP f+${u.hpFlat} nf+${u.hpFlatNoPct} p+${u.hpPct}`);
  return p.join(', ') || '-';
};

console.log('\n── 소스별 기여 (전 버킷) ──');
for (const [label, v] of Object.entries(stats) as [string, CharacterStats[keyof CharacterStats]][]) {
  if (v == null) continue;
  if (label === '크리티컬리인포스') { console.log(`  ${label}: 크확의 ${v}% → 크뎀 전환 (D 계산 시)`); continue; }
  if (label === '메이플용사') {
    const u = emptyUserStat();
    const ap = stats.AP as Record<string, number>;
    for (const k of MAIN) u.flat[k] += Math.floor(((ap[k] ?? 0) * (v as number)) / 100);
    console.log(`  ${label.padEnd(8)}: ${fmtAll(u)} (AP의 ${v}%)`);
    continue;
  }
  const blocks = typeof v === 'object' && Object.values(v).every((x) => typeof x === 'number' || Array.isArray(x))
    ? [v as StatBlock]
    : Object.values(v as Record<string, StatBlock>);
  console.log(`  ${label.padEnd(8)}: ${fmtAll(usOf(blocks))}`);
}
process.exit(0);
