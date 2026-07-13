import { describe, expect, it } from 'vitest';
import type { PropensityRes } from '../../nexon/index.js';
import { getPropensity } from './propensity.js';

describe('성향 → StatBlock', () => {
  it('카리스마만 방무(lv×0.1)로 반영한다', () => {
    const propensity = { charisma_level: 100, insight_level: 100 } as PropensityRes;
    expect(getPropensity(propensity)).toEqual({ 방무: [10] });
  });

  it('카리스마 0이면 빈 블록', () => {
    expect(getPropensity({ charisma_level: 0 } as PropensityRes)).toEqual({});
  });
});
