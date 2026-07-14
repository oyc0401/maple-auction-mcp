import { describe, expect, it } from 'vitest';
import type { HexaMatrixStatRes } from '../../nexon/index.js';
import { getHexaStat } from './hexaStat.js';

describe('getHexaStat', () => {
  it('미구현 상태를 명시한다', () => {
    expect(() => getHexaStat({} as HexaMatrixStatRes)).toThrow(
      'TODO: getHexaStat'
    );
  });
});
