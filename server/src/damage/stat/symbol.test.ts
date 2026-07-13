import { describe, expect, it } from 'vitest';
import type { SymbolEquipmentRes } from '../../nexon/index.js';
import { getSymbol } from './symbol.js';

function symbolRes(lines: Array<Partial<Record<'symbol_str' | 'symbol_dex' | 'symbol_int' | 'symbol_luk' | 'symbol_hp', string>>>): SymbolEquipmentRes {
  return { date: null, character_class: '', symbol: lines.map((l) => ({ symbol_str: '0', symbol_dex: '0', symbol_int: '0', symbol_luk: '0', symbol_hp: '0', ...l })) } as unknown as SymbolEquipmentRes;
}

describe('심볼 → StatBlock', () => {
  it('주스탯·HP를 미적용 버킷으로 합산한다', () => {
    const symbol = symbolRes([
      { symbol_dex: '2200' },
      { symbol_dex: '2000', symbol_hp: '3600' },
    ]);
    expect(getSymbol(symbol)).toEqual({ DEX미적용: 4200, HP미적용: 3600 });
  });

  it('0 스탯은 키를 만들지 않는다', () => {
    expect(getSymbol(symbolRes([{ symbol_luk: '0' }]))).toEqual({});
  });
});
