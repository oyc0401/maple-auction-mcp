// example.json 생성 스크립트 (일회용) — .nexon-raw-오유찬.json 캐시를 소스별로 재집계해
// stat-interface.ts의 CharacterStats 형태로 뽑는다. API 호출 없음.
// 실행: pnpm tsx server/src/damage/gen-example.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { emptyUserStat, type UserStat, type MainStat } from './statSheet.js';
import {
  collectGearItem, collectSet, collectSymbol, collectHyper, collectAbility, collectBaseAP,
  collectUnion, collectArtifact, collectChampion, collectPropensity, collectTitle,
  collectChallenger, collectBurning, hasBurning, BURNING_TOOLTIP,
} from './collect.js';
import { collectLinkSkills } from './linkSkill.js';
import { collectSkillPassive, type SkillsByGrade } from './skillPassive.js';
import { collectHexaStat } from './hexaStat.js';
import { aggregateCharacter, type RawBundle } from './nexon.js';
import type { StatBlock, CharacterStats } from './stat-interface.js';

const MAIN: MainStat[] = ['STR', 'DEX', 'INT', 'LUK'];
const name = '오유찬';
const { raw: bundle, warnings } = JSON.parse(
  readFileSync(new URL(`../../../.nexon-raw-${name}.json`, import.meta.url), 'utf8'),
) as { raw: RawBundle; warnings: string[] };

const agg = aggregateCharacter(name, bundle, warnings);
const statMap: Record<string, number> = agg.raw.statMap;
const level = Number(bundle.basic?.character_level ?? 0);
const cls: string = agg.raw.class;
const mainKey: MainStat = agg.raw.mainKey;

// ── UserStat → StatBlock (0인 필드는 생략) ──────────────────────────
function toBlock(u: UserStat): StatBlock {
  const b: Record<string, number | number[]> = {};
  for (const k of MAIN) if (u.flat[k]) b[k] = u.flat[k];
  for (const k of MAIN) if (u.flatNoPct[k]) b[`${k}미적용`] = u.flatNoPct[k];
  for (const k of MAIN) if (u.pct[k]) b[`${k}%`] = u.pct[k];
  if (u.allFlat) b['올스탯'] = u.allFlat;
  if (u.allPct) b['올스탯%'] = u.allPct;
  if (u.atk) b['공격력'] = u.atk;
  if (u.matk) b['마력'] = u.matk;
  if (u.atkPct) b['공격력%'] = u.atkPct;
  if (u.matkPct) b['마력%'] = u.matkPct;
  if (u.damage) b['데미지'] = u.damage;
  if (u.bossDmg) b['보공'] = u.bossDmg;
  if (u.statusDmg) b['추가뎀'] = u.statusDmg;
  if (u.ignoreDef.length) b['방무'] = u.ignoreDef;
  if (u.finalDmg.length) b['최종뎀'] = u.finalDmg;
  if (u.critRate) b['크확'] = u.critRate;
  if (u.critDmg) b['크뎀'] = u.critDmg;
  if (u.hpFlat) b['HP'] = u.hpFlat;
  if (u.hpFlatNoPct) b['HP미적용'] = u.hpFlatNoPct;
  if (u.hpPct) b['HP%'] = u.hpPct;
  return b as StatBlock;
}
const isEmpty = (b: StatBlock) => Object.keys(b).length === 0;
const blockOf = (fn: (u: UserStat) => void): StatBlock => { const u = emptyUserStat(); fn(u); return toBlock(u); };

// ── 장비 (부위별) ───────────────────────────────────────────────────
// 잠재 "캐릭터 기준 9레벨 당 X +M"은 인터페이스 규약대로 레벨당X=M으로 보존(깡 환산 안 함).
// 9레벨이 아닌 주기는 인터페이스에 자리가 없어 깡으로 환산해 넣고 경고.
const RE_PER_LEVEL = /캐릭터 기준\s*(\d+)레벨 당\s*(.+?)\s*\+\s*(\d+(?:\.\d+)?)/;
const STAT_ALIAS: Record<string, MainStat> = {
  STR: 'STR', DEX: 'DEX', INT: 'INT', LUK: 'LUK',
  힘: 'STR', 민첩: 'DEX', 지력: 'INT', 운: 'LUK', 민첩성: 'DEX', 지능: 'INT', 행운: 'LUK',
};
const SLOT_KEY: Record<string, string> = { '포켓 아이템': '포켓아이템', '기계 심장': '기계심장' };
const POTENTIAL_KEYS = [
  'potential_option_1', 'potential_option_2', 'potential_option_3',
  'additional_potential_option_1', 'additional_potential_option_2', 'additional_potential_option_3',
];
const gear: Record<string, StatBlock> = {};
for (const it of bundle.equip?.item_equipment ?? []) {
  const b = blockOf((u) => collectGearItem(u, it, 0)) as Record<string, number | number[]>; // level 0 → 레벨당 라인 기여 0
  for (const k of POTENTIAL_KEYS) {
    const per = typeof it[k] === 'string' ? it[k].match(RE_PER_LEVEL) : null;
    if (!per) continue;
    const main = STAT_ALIAS[per[2].trim()];
    if (Number(per[1]) === 9 && main) {
      b[`레벨당${main}`] = ((b[`레벨당${main}`] as number) ?? 0) + Number(per[3]);
    } else if (main) {
      console.warn(`⚠️ ${it.item_equipment_slot}: ${per[1]}레벨 당 라인 — 깡으로 환산`);
      b[main] = ((b[main] as number) ?? 0) + Math.floor(level / Number(per[1])) * Number(per[3]);
    }
  }
  if (Object.keys(b).length === 0) continue;
  const slot = SLOT_KEY[it.item_equipment_slot] ?? it.item_equipment_slot;
  if (gear[slot]) console.warn(`⚠️ 슬롯 중복: ${slot}`);
  gear[slot] = b as StatBlock;
}
const title = blockOf((u) => collectTitle(u, bundle.equip));
if (!isEmpty(title)) gear['칭호'] = title;

// ── 세트효과 (세트별) ───────────────────────────────────────────────
const sets: Record<string, StatBlock> = {};
for (const s of bundle.setEff?.set_effect ?? []) {
  const b = blockOf((u) => collectSet(u, [s]));
  if (!isEmpty(b)) sets[s.set_name] = b;
}

// ── 메이플 용사: AP 직접투자 스탯 N% — N만 저장 ─────────────────────
let mwPct = 0;
for (const arr of Object.values(bundle.skills ?? {})) {
  for (const s of arr) {
    const mm = String(s.skill_effect ?? '').match(/AP를 직접 투자한 모든 능력치\s*(\d+(?:\.\d+)?)\s*%/);
    if (mm) { mwPct = Number(mm[1]); break; }
  }
  if (mwPct) break;
}

// ── 링크 스킬 (스킬별, resting 무조건형만) ──────────────────────────
const links: Record<string, StatBlock> = {};
{
  const transferred = bundle.link?.character_link_skill ?? bundle.link?.character_link_skill_info ?? [];
  const owned = bundle.link?.character_owned_link_skill;
  for (const s of [...transferred, ...(owned ? [owned].flat() : [])]) {
    const b = blockOf((u) => collectLinkSkills(u, { character_link_skill: [s] }, false));
    if (isEmpty(b)) continue;
    const key = String(s.skill_name ?? '').replace(/\([^)]*\)\s*$/, '').trim(); // 본인 링크 "(직업)" 접미사 제거
    links[key] = b;
  }
}

// ── 직업/공통 스킬 패시브 (차수별·스킬별, resting 무조건형만) ────────
const ownedAll = new Set<string>();
for (const arr of Object.values(bundle.skills ?? {})) for (const s of arr) ownedAll.add(s.skill_name);
const skillsByGrade: Record<string, Record<string, StatBlock>> = {};
for (const grade of ['0', '1', '2', '3', '4', '5']) {
  for (const s of bundle.skills?.[grade] ?? []) {
    // 쓸만한 X는 본체 X 보유 시 중첩 불가 — 단건 재집계에선 owned가 비어 스킵이 안 되므로 전체 보유 목록으로 직접 게이팅
    if (s.skill_name.startsWith('쓸만한 ') && ownedAll.has(s.skill_name.slice('쓸만한 '.length))) continue;
    const b = blockOf((u) => collectSkillPassive(u, cls, { [grade]: [s] } as SkillsByGrade, false));
    if (isEmpty(b)) continue;
    (skillsByGrade[grade] ??= {})[s.skill_name] = b;
  }
}

// ── 단일 블록 소스들 ────────────────────────────────────────────────
const preset = bundle.hyper?.[`hyper_stat_preset_${bundle.hyper?.use_preset_no ?? 1}`];
const single = {
  AP: blockOf((u) => collectBaseAP(u, statMap)),
  심볼: blockOf((u) => bundle.symbol && collectSymbol(u, bundle.symbol.symbol)),
  하이퍼스탯: blockOf((u) => collectHyper(u, preset)),
  어빌리티: blockOf((u) => bundle.ability && collectAbility(u, bundle.ability.ability_info)),
  유니온: blockOf((u) => bundle.union && collectUnion(u, bundle.union)),
  아티팩트: blockOf((u) => bundle.artifact && collectArtifact(u, bundle.artifact)),
  챔피언: blockOf((u) => bundle.champion && collectChampion(u, bundle.champion)),
  성향: blockOf((u) => bundle.propensity && collectPropensity(u, bundle.propensity)),
  헥사스탯: blockOf((u) => bundle.hexa && collectHexaStat(u, bundle.hexa, mainKey, mainKey === 'INT', cls === '제논' ? 'xenon' : cls === '데몬어벤져' ? 'deven' : 'normal')),
  챌린저스: blockOf((u) => bundle.basic?.world_name === '챌린저스' && collectChallenger(u)),
  버닝: blockOf((u) => hasBurning(bundle.skills) && collectBurning(u, BURNING_TOOLTIP)),
};

// ── CharacterStats 조립 (인터페이스 필드 순서대로, 빈 소스는 생략) ──
// 기본: 베이스 크확 5% (모든 캐릭터 공통, 넥슨 크확 필드에 포함 — cli.ts 티엘 실측)
const out: CharacterStats = { 기본: { 크확: 5 }, AP: single.AP };
if (mwPct) out.메이플용사 = mwPct;
if (Object.keys(gear).length) out.장비 = gear;
if (Object.keys(sets).length) out.세트효과 = sets;
for (const [k, v] of Object.entries(single)) {
  if (k === 'AP' || isEmpty(v)) continue;
  if (k !== '헥사스탯' && k !== '챌린저스' && k !== '버닝') (out as any)[k] = v;
}
for (const [grade, rec] of Object.entries(skillsByGrade)) (out as any)[`스킬_${grade}차`] = rec;
if (Object.keys(links).length) out.링크스킬 = links;
if (!isEmpty(single.헥사스탯)) out.헥사스탯 = single.헥사스탯;
if (!isEmpty(single.챌린저스)) out.챌린저스 = single.챌린저스;
if (!isEmpty(single.버닝)) out.버닝 = single.버닝;

// ── 검증: JSON을 다시 UserStat으로 합산 → aggregateCharacter 결과와 전 버킷 대조 ──
function addBlock(u: UserStat, b: StatBlock): void {
  const r = b as Record<string, number | number[]>;
  for (const k of MAIN) {
    u.flat[k] += (r[k] as number) ?? 0;
    u.flatNoPct[k] += (r[`${k}미적용`] as number) ?? 0;
    u.pct[k] += (r[`${k}%`] as number) ?? 0;
    u.flat[k] += Math.floor(level / 9) * ((r[`레벨당${k}`] as number) ?? 0);
  }
  u.allFlat += (r['올스탯'] as number) ?? 0;
  for (const k of MAIN) u.flatNoPct[k] += (r['올스탯미적용'] as number) ?? 0;
  u.allPct += (r['올스탯%'] as number) ?? 0;
  u.atk += (r['공격력'] as number) ?? 0;
  u.matk += (r['마력'] as number) ?? 0;
  u.atkPct += (r['공격력%'] as number) ?? 0;
  u.matkPct += (r['마력%'] as number) ?? 0;
  u.damage += (r['데미지'] as number) ?? 0;
  u.bossDmg += (r['보공'] as number) ?? 0;
  u.statusDmg += (r['추가뎀'] as number) ?? 0;
  u.ignoreDef.push(...((r['방무'] as number[]) ?? []));
  u.finalDmg.push(...((r['최종뎀'] as number[]) ?? []));
  u.critRate += (r['크확'] as number) ?? 0;
  u.critDmg += (r['크뎀'] as number) ?? 0;
  u.hpFlat += (r['HP'] as number) ?? 0;
  u.hpFlatNoPct += (r['HP미적용'] as number) ?? 0;
  u.hpPct += (r['HP%'] as number) ?? 0;
}
const sum = emptyUserStat();
addBlock(sum, out.기본);
addBlock(sum, out.AP);
if (out.메이플용사) for (const k of MAIN) sum.flat[k] += Math.floor((statMap[`AP 배분 ${k}`] ?? 0) * out.메이플용사 / 100);
for (const src of [out.장비, out.세트효과, out.링크스킬, ...Object.values(skillsByGrade)]) {
  for (const b of Object.values(src ?? {})) addBlock(sum, b as StatBlock);
}
for (const k of ['심볼', '하이퍼스탯', '어빌리티', '유니온', '아티팩트', '챔피언', '성향', '헥사스탯', '챌린저스', '버닝'] as const) {
  if (out[k]) addBlock(sum, out[k]!);
}
const ref = agg.userStat;
const diffs: string[] = [];
const cmp = (label: string, a: number, b: number) => { if (Math.abs(a - b) > 1e-9) diffs.push(`${label}: json ${a} vs 수집 ${b}`); };
for (const k of MAIN) { cmp(`flat.${k}`, sum.flat[k], ref.flat[k]); cmp(`flatNoPct.${k}`, sum.flatNoPct[k], ref.flatNoPct[k]); cmp(`pct.${k}`, sum.pct[k], ref.pct[k]); }
cmp('allFlat', sum.allFlat, ref.allFlat); cmp('allPct', sum.allPct, ref.allPct);
cmp('atk', sum.atk, ref.atk); cmp('matk', sum.matk, ref.matk);
cmp('atkPct', sum.atkPct, ref.atkPct); cmp('matkPct', sum.matkPct, ref.matkPct);
cmp('damage', sum.damage, ref.damage); cmp('bossDmg', sum.bossDmg, ref.bossDmg); cmp('statusDmg', sum.statusDmg, ref.statusDmg);
cmp('critRate', sum.critRate, ref.critRate + 5); cmp('critDmg', sum.critDmg, ref.critDmg); // +5 = 기본 크확 (수집기 밖 베이스)
cmp('hpFlat', sum.hpFlat, ref.hpFlat); cmp('hpFlatNoPct', sum.hpFlatNoPct, ref.hpFlatNoPct); cmp('hpPct', sum.hpPct, ref.hpPct);
const multiset = (a: number[]) => [...a].sort((x, y) => x - y).join(',');
if (multiset(sum.ignoreDef) !== multiset(ref.ignoreDef)) diffs.push(`방무: json [${multiset(sum.ignoreDef)}] vs 수집 [${multiset(ref.ignoreDef)}]`);
if (multiset(sum.finalDmg) !== multiset(ref.finalDmg)) diffs.push(`최종뎀: json [${multiset(sum.finalDmg)}] vs 수집 [${multiset(ref.finalDmg)}]`);

if (diffs.length) { console.error('❌ 재집계 불일치:\n  ' + diffs.join('\n  ')); process.exit(1); }
console.log('✅ 전 버킷 재집계 일치 (aggregateCharacter 대조)');

// 참고: API 주스탯 재구성 잔차 (기존 cli.ts 공식)
for (const k of MAIN) {
  const recon = Math.floor((sum.flat[k] + sum.allFlat) * (1 + (sum.pct[k] + sum.allPct) / 100)) + sum.flatNoPct[k];
  console.log(`  ${k}: 재구성 ${recon} vs API ${agg.final.finalMain[k]} → 잔차 ${recon - agg.final.finalMain[k]}`);
}

writeFileSync(new URL('./example.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log(`\n[${name}] ${cls} Lv.${level} → example.json 저장 완료`);
