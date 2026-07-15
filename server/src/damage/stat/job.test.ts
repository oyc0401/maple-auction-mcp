import { describe, expect, it } from 'vitest';
import jobExample from './job-example.json' with { type: 'json' };
import { getJobClass, JOB_STAT } from './job.js';

describe('getJobClass', () => {
  it('경매장 reqJob과 같은 어휘(전사·마법사·궁수·도적·해적)로 답한다', () => {
    expect(getJobClass('카데나')).toBe('도적');
    expect(getJobClass('비숍')).toBe('마법사');
    expect(getJobClass('보우마스터')).toBe('궁수');
    expect(getJobClass('히어로')).toBe('전사');
    expect(getJobClass('바이퍼')).toBe('해적');
  });

  it('주스탯과 직업군은 별개다', () => {
    // 은월·아크는 STR이지만 해적, 렌은 DEX지만 전사
    expect(JOB_STAT.은월).toBe('STR');
    expect(getJobClass('은월')).toBe('해적');
    expect(JOB_STAT.렌).toBe('DEX');
    expect(getJobClass('렌')).toBe('전사');
  });

  it('제로는 전사, 제논은 도적이다', () => {
    expect(getJobClass('제로')).toBe('전사');
    expect(getJobClass('제논')).toBe('도적');
  });

  it('모르는 직업은 추측하지 않는다', () => {
    expect(getJobClass('없는직업')).toBeNull();
  });

  // 넥슨 character_class 값 48개가 전부 들어있어야 한다.
  // 하나라도 빠지면 그 직업은 매물 착용 가능 판정이 통째로 막힌다.
  it('넥슨이 주는 직업 48개를 모두 안다', () => {
    const missing = Object.keys(jobExample).filter((job) => !getJobClass(job));
    expect(missing).toEqual([]);
  });
});
