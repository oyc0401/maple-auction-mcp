// 스탯 수집 진단 CLI — 1회 실측: pnpm tsx server/src/damage/cli.ts [닉네임]
// CharacterStats(소스별 블록)를 조립해 소스별 기여 + 재구성 대조를 출력한다.
// 넥슨 API 원본은 디스크에 캐시(.nexon-raw-<닉>.json) — 재실행 시 API를 다시 쏘지 않고 재집계만 한다.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fetchCharacterRaw, aggregateCharacter, type RawBundle } from './nexon.js';
import { emptyUserStat, type UserStat, type MainStat } from './statSheet.js';
import type { StatBlock, CharacterStats } from './stat-interface.js';
import { addBlock, MAIN } from './block.js';

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
const { final, userStat: us, stats, warnings } = aggregateCharacter(name, bundle, fetchWarnings);

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
  if (u.statusDmg) p.push(`상태이상뎀+${u.statusDmg}`);
  if (u.ignoreDef.length) p.push(`방무[${u.ignoreDef.join(',')}]`);
  if (u.finalDmg.length) p.push(`최종[${u.finalDmg.join(',')}]`);
  if (u.critRate) p.push(`크확+${u.critRate}`); if (u.critDmg) p.push(`크뎀+${u.critDmg}`);
  if (u.hpFlat || u.hpFlatNoPct || u.hpPct) p.push(`HP f+${u.hpFlat} nf+${u.hpFlatNoPct} p+${u.hpPct}`);
  return p.join(', ') || '-';
};

// 소스별 전 버킷 기여 — CharacterStats의 필드 구조(단일 블록/블록 묶음/숫자)를 그대로 순회
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

// 부위별 gear 주스탯% 분해 (버그 헌팅)
console.log('\n── 장비별 LUK%/올스탯% 기여 ──');
for (const [slot, b] of Object.entries((stats.장비 ?? {}) as Record<string, StatBlock>)) {
  const u = usOf([b]);
  if (u.pct.LUK || u.allPct || u.flat.LUK) {
    console.log(`  ${slot.padEnd(6)}: LUKflat+${u.flat.LUK} LUK%+${u.pct.LUK} 올%+${u.allPct}`);
  }
}

console.log('\n── 재구성 vs API (주스탯) ──  [(flat+올flat)×(1+(pct+올pct)/100)+flatNoPct]');
for (const k of MAIN) {
  const recon = Math.floor((us.flat[k] + us.allFlat) * (1 + (us.pct[k] + us.allPct) / 100)) + us.flatNoPct[k];
  const gap = recon - final.finalMain[k];
  console.log(`  ${k}: 재구성 ${recon} vs API ${final.finalMain[k]}  → 잔차 ${gap > 0 ? '+' : ''}${gap}  (flat ${us.flat[k]}+올${us.allFlat}, pct ${us.pct[k]}+올${us.allPct})`);
}

// ── 주스탯 외 잔차: 공/마·데미지·보공·방무·크확·크뎀 ──
// 방무는 곱연산: 100×(1−∏(1−v/100)). 나머지는 가산.
console.log('\n── 재구성 vs API (공·데미지 계열) ──');
const m = final.raw;
const round2 = (v: number) => Math.round(v * 100) / 100;
const iedRecon = round2(100 * (1 - us.ignoreDef.reduce((a, v) => a * (1 - v / 100), 1)));
const rows: [string, number, number][] = [
  // 공격력 = floor(공flat × (1+공%/100)) — 실측 재구성 일치로 확정한 공식
  ['공격력', Math.floor(us.atk * (1 + us.atkPct / 100)), m['공격력'] ?? 0],
  ['마력', Math.floor(us.matk * (1 + us.matkPct / 100)), m['마력'] ?? 0],
  ['공격력flat수집', us.atk, NaN], ['공격력%수집', us.atkPct, NaN], // 참고 출력(API에 직접 대응값 없음)
  ['데미지', round2(us.damage), m['데미지'] ?? 0],
  ['보스 몬스터 데미지', round2(us.bossDmg), m['보스 몬스터 데미지'] ?? 0],
  ['상태이상 추가 데미지', round2(us.statusDmg), m['상태이상 추가 데미지'] ?? 0],
  ['방어율 무시', iedRecon, m['방어율 무시'] ?? 0],
  // 공통 베이스(크확 5, 크뎀 35)는 기본 블록에 들어 있다. 넥슨 API의 크리티컬 확률 필드는 베이스를
  // 포함하지만 크리티컬 데미지 필드는 포함하지 않으므로, 크뎀만 기본 블록 몫을 제외하고 대조한다.
  ['크리티컬 확률', us.critRate, m['크리티컬 확률'] ?? 0],
  ['크리티컬 데미지', round2(us.critDmg - ((stats.기본 as Record<string, number>)['크뎀'] ?? 0)), m['크리티컬 데미지'] ?? 0],
  ['최종 데미지', round2(100 * (us.finalDmg.reduce((a, v) => a * (1 + v / 100), 1) - 1)), m['최종 데미지'] ?? 0],
];
for (const [label, recon, api] of rows) {
  if (Number.isNaN(api)) { console.log(`  ${label}: 수집 ${recon} (API 대응값 없음 — 참고)`); continue; }
  const gap = round2(recon - api);
  console.log(`  ${label}: 재구성 ${recon} vs API ${api}  → 잔차 ${gap > 0 ? '+' : ''}${gap}`);
}
process.exit(0);
