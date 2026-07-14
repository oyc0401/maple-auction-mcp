// 제논=올스탯(STR·DEX·LUK), 데몬어벤져=HP
export type MainStat = 'STR' | 'DEX' | 'INT' | 'LUK';
export type JobStat = MainStat | 'xenon' | 'deven';

const BY_STAT: Record<MainStat, string[]> = {
  STR: [
    '히어로',
    '팔라딘',
    '다크나이트',
    '소울마스터',
    '미하일',
    '스트라이커',
    '블래스터',
    '데몬슬레이어',
    '아란',
    '카이저',
    '은월',
    '아크',
    '아델',
    '바이퍼',
    '캐논마스터',
    '제로',
  ],
  DEX: [
    '보우마스터',
    '신궁',
    '패스파인더',
    '캡틴',
    '윈드브레이커',
    '와일드헌터',
    '메카닉',
    '메르세데스',
    '엔젤릭버스터',
    '카인',
    '렌',
  ],
  INT: [
    '아크메이지(불,독)',
    '아크메이지(썬,콜)',
    '비숍',
    '플레임위자드',
    '배틀메이지',
    '에반',
    '루미너스',
    '키네시스',
    '일리움',
    '라라',
    '레테',
  ],
  LUK: [
    '나이트로드',
    '섀도어',
    '듀얼블레이드',
    '나이트워커',
    '팬텀',
    '카데나',
    '호영',
    '칼리',
  ],
};

export const JOB_STAT: Record<string, JobStat> = {
  제논: 'xenon',
  데몬어벤져: 'deven',
  ...Object.fromEntries(
    Object.entries(BY_STAT).flatMap(([stat, jobs]) =>
      jobs.map((job) => [job, stat as MainStat])
    )
  ),
};
