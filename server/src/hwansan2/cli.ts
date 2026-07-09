// server/src/hwansan2/cli.ts — 라이브 검증: pnpm tsx server/src/hwansan2/cli.ts <캐릭명>
// 1) baseline 환산  2) 제로시뮬 == baseline  3) 전 부위 항등교체 Δ0  4) 축 포킹 vs specEfficiency
import { fetchScouter, baseSimulator, simulate } from './scouterClient.js';
import { swapDelta380, clearSwapCache } from './swap.js';

const name = process.argv[2] ?? '오유찬';
const data = await fetchScouter(name);
console.log(`[baseline] ${name}: 380=${data.calculatedData.boss380_stat} 300=${data.calculatedData.boss300_stat}`);

const zero = await simulate(data.userStat, baseSimulator(data.userStat));
console.log(`[제로시뮬] 380=${zero.boss380_stat} (baseline과 일치해야 함: ${zero.boss380_stat === data.calculatedData.boss380_stat ? 'OK' : 'MISMATCH!'})`);

// 항등 교체: 현재 장비를 경매장 포맷으로 재구성해 Δ0인지 (무기 제외 전 부위)
let fails = 0;
for (const e of data.userEquipData) {
  if (e.slot === '무기') continue;
  const raw = {
    _id: `identity:${e.slot}`, itemName: e.name,
    toolTip: {
      stat: {
        str: Number(e.totalOption.str), dex: Number(e.totalOption.dex), int: Number(e.totalOption.int),
        luk: Number(e.totalOption.luk), mhp: Number(e.totalOption.max_hp), pad: Number(e.totalOption.attack_power),
        mad: Number(e.totalOption.magic_power), bdr: Number(e.totalOption.boss_damage), dam: Number(e.totalOption.damage),
        imdr: Number(e.totalOption.ignore_monster_armor), all: Number(e.totalOption.all_stat),
      },
      upgradeInfo: {
        potential: { entries: (e.potential_option_1 ?? []).filter(Boolean).map((text) => ({ text: text! })) },
        additionalPotential: { entries: (e.additional_potential_option_1 ?? []).filter(Boolean).map((text) => ({ text: text! })) },
      },
      soulWeapon: e.soul_option ? { soulName: '소울', optionText: e.soul_option } : undefined,
    },
  };
  const r = await swapDelta380(data, e.slot, raw);
  const ok = r && r.delta380 === 0;
  if (!ok) fails++;
  console.log(`[항등:${e.slot}] Δ380=${r?.delta380 ?? 'null'} ${ok ? 'OK' : 'FAIL'}${r?.unknown.length ? ' unknown=' + r.unknown.join('|') : ''}`);
  await new Promise((r) => setTimeout(r, 300)); // 서버 예의
}
console.log(fails === 0 ? '항등 교체 전부 통과' : `항등 실패 ${fails}건 — axes/sets 로직 점검 필요`);

// 축 포킹: mainStat +1000 → specEfficiency.mainStateff1과 방향/크기 대조 (의미 검증)
clearSwapCache();
const poke = { ...baseSimulator(data.userStat), mainStat: '1000' };
const poked = await simulate(data.userStat, poke);
console.log(`[포킹 mainStat+1000] Δ380=${poked.boss380_stat - data.calculatedData.boss380_stat} (양수여야 정상)`);
