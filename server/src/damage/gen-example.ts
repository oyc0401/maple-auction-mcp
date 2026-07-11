// example.json 생성 스크립트 (일회용) — .nexon-raw-<닉>.json 캐시를 재집계해
// CharacterStats(stat-interface)를 그대로 저장한다. API 호출 없음.
// UserStat은 이제 CharacterStats를 flatten해 파생하므로(aggregateCharacter) 별도 재집계 검증이 필요 없다 —
// 저장물과 계산 입력이 구조적으로 동일하고, 정합성은 아래 API 잔차로 확인한다.
// 실행: pnpm tsx server/src/damage/gen-example.ts [닉네임]
import { readFileSync, writeFileSync } from 'node:fs';
import { aggregateCharacter, type RawBundle } from './nexon.js';
import { MAIN } from './block.js';

const name = process.argv[2] ?? '오유찬';
const { raw: bundle, warnings } = JSON.parse(
  readFileSync(new URL(`../../../.nexon-raw-${name}.json`, import.meta.url), 'utf8'),
) as { raw: RawBundle; warnings: string[] };

const agg = aggregateCharacter(name, bundle, warnings);
if (agg.warnings.length) console.warn('⚠️ ', agg.warnings.join(' | '));

// 참고: API 주스탯 재구성 잔차
const us = agg.userStat;
for (const k of MAIN) {
  const recon = Math.floor((us.flat[k] + us.allFlat) * (1 + (us.pct[k] + us.allPct) / 100)) + us.flatNoPct[k];
  console.log(`  ${k}: 재구성 ${recon} vs API ${agg.final.finalMain[k]} → 잔차 ${recon - agg.final.finalMain[k]}`);
}

writeFileSync(new URL('./example.json', import.meta.url), JSON.stringify(agg.stats, null, 2) + '\n');
console.log(`\n[${name}] ${agg.final.characterClass} Lv.${agg.final.level} → example.json 저장 완료`);
