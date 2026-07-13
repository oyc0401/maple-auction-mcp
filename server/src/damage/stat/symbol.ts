import type { SymbolEquipmentRes } from '../../nexon/index.js';
import type { StatBlock } from '../stat-interface.js';

const num = (v: unknown): number => Number(v ?? 0) || 0;

function add(block: StatBlock, key: 'STR미적용' | 'DEX미적용' | 'INT미적용' | 'LUK미적용' | 'HP미적용', value: number): void {
  if (value) block[key] = (block[key] ?? 0) + value;
}

// 심볼 → StatBlock. symbol_str/dex/int/luk/hp는 정형 숫자 필드라 파싱이 아니라 직접 합산한다.
// 심볼 스탯은 주스탯%·올스탯% 미적용(툴팁 명시). 캐릭터 주스탯 외 필드는 0이라 자연 제외된다.
export function getSymbol(symbol: SymbolEquipmentRes): StatBlock {
  const block: StatBlock = {};
  for (const s of symbol.symbol ?? []) {
    add(block, 'STR미적용', num(s.symbol_str));
    add(block, 'DEX미적용', num(s.symbol_dex));
    add(block, 'INT미적용', num(s.symbol_int));
    add(block, 'LUK미적용', num(s.symbol_luk));
    add(block, 'HP미적용', num(s.symbol_hp));
  }
  return block;
}
