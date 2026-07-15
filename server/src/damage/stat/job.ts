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

// 직업군. 경매장 매물의 toolTip.reqJob이 쓰는 어휘와 같은 값이어야 한다
// (실측 2026-07-16: 아케인셰이드 스태프 reqJob = "마법사").
// 키는 넥슨 character_class 표기를 따른다 — job-example.json이 그 어휘의 전부다.
// 주스탯(BY_STAT)과는 별개다: 은월·아크는 STR이지만 해적, 렌은 DEX지만 전사.
export type JobClass = '전사' | '마법사' | '궁수' | '도적' | '해적';

const BY_CLASS: Record<JobClass, string[]> = {
  전사: [
    '히어로',
    '팔라딘',
    '다크나이트',
    '소울마스터',
    '미하일',
    '아란',
    '데몬슬레이어',
    '데몬어벤져',
    '블래스터',
    '카이저',
    '아델',
    '렌',
    '제로',
  ],
  마법사: [
    '아크메이지(불,독)',
    '아크메이지(썬,콜)',
    '비숍',
    '플레임위자드',
    '에반',
    '루미너스',
    '배틀메이지',
    '일리움',
    '라라',
    '키네시스',
    '레테',
  ],
  궁수: ['보우마스터', '신궁', '패스파인더', '윈드브레이커', '메르세데스', '와일드헌터', '카인'],
  도적: [
    '나이트로드',
    '섀도어',
    '듀얼블레이드',
    '나이트워커',
    '팬텀',
    '제논',
    '카데나',
    '칼리',
    '호영',
  ],
  해적: ['바이퍼', '캡틴', '캐논마스터', '스트라이커', '은월', '메카닉', '엔젤릭버스터', '아크'],
};

const JOB_CLASS: Record<string, JobClass> = Object.fromEntries(
  Object.entries(BY_CLASS).flatMap(([jobClass, jobs]) =>
    jobs.map((job) => [job, jobClass as JobClass])
  )
);

export function getJobClass(job: string): JobClass | null {
  return JOB_CLASS[job] ?? null;
}

export const JOB_STAT: Record<string, JobStat> = {
  제논: 'xenon',
  데몬어벤져: 'deven',
  ...Object.fromEntries(
    Object.entries(BY_STAT).flatMap(([stat, jobs]) =>
      jobs.map((job) => [job, stat as MainStat])
    )
  ),
};
