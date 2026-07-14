import { describe, expect, it } from 'vitest';
import type { UnionRaiderRes } from '../../nexon/index.js';
import { getUnionRaider } from './unionRaider.js';

const res = (union_raider_stat: string[]) =>
  ({ union_raider_stat }) as unknown as UnionRaiderRes;

describe('유니온 배치(union_raider) → StatBlock', () => {
  it('주스탯·올스탯·HP는 미적용 누산, 딜 %스탯 수집, 무관 라인 무시', () => {
    // 렌 실측 union_raider_stat 일부(ALLSTAT·복합·HP 폼 포함)
    const block = getUnionRaider(
      res([
        'STR 100 증가',
        'STR 100 증가',
        'INT 80 증가',
        'STR, DEX, LUK 50 증가',
        'ALLSTAT 40, 최대 HP 2000 증가',
        '최대 HP 6% 증가',
        '공격력/마력 25 증가',
        '보스 몬스터 공격 시 데미지 6% 증가',
        '방어율 무시 6% 증가',
        '크리티컬 데미지 6% 증가',
        '크리티컬 확률 5% 증가',
        '크리티컬 확률 5% 증가',
        '경험치 획득량 12% 증가', // 무시
        '공격 시 20%의 확률로 데미지 20% 증가', // 무시
        '적 공격마다 70%의 확률로 순수 HP의 10% 회복', // 무시
        '상태 이상 내성 5 증가', // 무시
        '스킬 재사용 대기시간 6% 감소', // 무시
        '이동속도, 최대 이동속도 10 증가. 최대 이동속도 170 이상 시 초과분의 20% 적용, 렌 공격대원 효과로 증가하는 최대 이동속도는 190 초과 불가', // 무시
      ])
    );
    expect(block).toEqual({
      STR미적용: 250, // 100+100+50(복합)
      INT미적용: 80,
      DEX미적용: 50,
      LUK미적용: 50,
      올스탯미적용: 40, // ALLSTAT
      HP미적용: 2000,
      HP퍼: 6,
      공격력: 25,
      마력: 25,
      보공: 6,
      방무: [6],
      크뎀: 6,
      크확: 10, // 5+5
    });
  });
});
