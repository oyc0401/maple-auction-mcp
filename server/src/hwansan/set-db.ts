// 세트 효과 DB — 단계별 증분 옵션. 세트명 base 키(직업 변형 접미사 제거).
// 근거: 나무위키 각 세트 문서(현행 KMS) + 넥슨 오픈 API set-effect 실측 교차검증(앱솔 2-5셋·에테르넬 일치).
// 핵심: 세트효과 수치는 전 직업군 동일(INT는 마력, 그 외 공격력 — 같은 수치). 그래서 atk 하나로 적고
// 환산 계산 시 주스탯 종류에 맞는 쪽(공격력/마력)만 사용한다(중복 계상 없음). 최대HP/MP·방어력은 환산 무관이라 생략.

// 한 세트 단계가 추가로 주는 옵션(증분). 환산에 영향 있는 항목만. 없는 값은 0.
export interface SetTier {
  atk?: number; // 공격력 = 마력 (전 직업 동일 수치, 주력에 맞는 쪽만 반영)
  allStat?: number; // 올스탯 (수치)
  boss?: number; // 보스 몬스터 데미지 %
  ida?: number; // 몬스터 방어율 무시 %
  critDmg?: number; // 크리티컬 데미지 %
}

export const SET_DB: Record<string, Record<number, SetTier>> = {
  아케인셰이드: {
    2: { atk: 30, boss: 10 },
    3: { atk: 30, ida: 10 },
    4: { allStat: 50, atk: 35, boss: 10 },
    5: { atk: 40, boss: 10 },
    6: { atk: 30 },
    7: { atk: 30, ida: 10 },
  },
  에테르넬: {
    2: { atk: 40, boss: 10 },
    3: { allStat: 50, atk: 40, boss: 10 },
    4: { atk: 40, boss: 10 },
    5: { atk: 40, ida: 20 },
    6: { atk: 40, boss: 15 },
    7: { allStat: 50, atk: 40, boss: 15 },
    8: { atk: 40, boss: 15 },
  },
  앱솔랩스: {
    2: { atk: 20, boss: 10 },
    3: { allStat: 30, atk: 20, boss: 10 },
    4: { atk: 25, ida: 10 },
    5: { atk: 30, boss: 10 },
    6: { atk: 20 },
    7: { atk: 20, ida: 10 },
  },
  루타비스: {
    2: { allStat: 20 },
    3: { atk: 50 },
    4: { boss: 30 },
  },
  // 마스터 카오스(방어구 세트, 저티어). 실측: set-effect API 3셋/5셋만 정의.
  '마스터 카오스': {
    3: { allStat: 5, atk: 3 },
    5: { allStat: 10, atk: 7 },
  },
  // ── 장신구 세트 ──
  // 광휘의 보스: 실측(set-effect API) — 2셋 보공15%, 3셋 방무15%, 4셋 크뎀5%.
  '광휘의 보스': {
    2: { allStat: 20, atk: 20, boss: 15 },
    3: { allStat: 20, atk: 20, ida: 15 },
    4: { allStat: 20, atk: 20, critDmg: 5 },
  },
  '여명의 보스': {
    2: { allStat: 10, atk: 10, boss: 10 },
    3: { allStat: 10, atk: 10 },
    4: { allStat: 10, atk: 10, ida: 10 },
  },
  '칠흑의 보스': {
    2: { allStat: 10, atk: 10, boss: 10 },
    3: { allStat: 10, atk: 10, ida: 10 },
    4: { allStat: 15, atk: 15, critDmg: 5 },
    5: { allStat: 15, atk: 15, boss: 10 },
    6: { allStat: 15, atk: 15, ida: 10 },
    7: { allStat: 15, atk: 15, critDmg: 5 },
    8: { allStat: 15, atk: 15, boss: 10 },
    9: { allStat: 15, atk: 15, critDmg: 5 },
    10: { allStat: 20, atk: 20, boss: 10 },
  },
  '보스 장신구': {
    3: { allStat: 10, atk: 5 },
    5: { allStat: 10, atk: 5 },
    7: { allStat: 10, atk: 10, ida: 10 },
    9: { allStat: 15, atk: 10, boss: 10 },
  },
};
