// 스탯 단일 진실 원천.
export interface StatBlock {
  // ── 깡 주스탯 (스탯% 적용) ──
  STR?: number;
  DEX?: number;
  INT?: number;
  LUK?: number;
  // ── 깡 주스탯 (스탯% 미적용) ──
  STR미적용?: number;
  DEX미적용?: number;
  INT미적용?: number;
  LUK미적용?: number;
  // ── 주스탯 % ──
  'STR%'?: number;
  'DEX%'?: number;
  'INT%'?: number;
  'LUK%'?: number;
  // ── 올스탯 ──
  올스탯?: number;
  올스탯미적용?: number;
  '올스탯%'?: number;
  // ── 레벨당 주스탯 (잠재 "9레벨 당 +M"의 M) ──
  레벨당STR?: number;
  레벨당DEX?: number;
  레벨당INT?: number;
  레벨당LUK?: number;
  // ── 공격력 / 마력 ──
  공격력?: number;
  마력?: number;
  '공격력%'?: number;
  '마력%'?: number;
  // ── 데미지 계열 ──
  데미지?: number;
  보공?: number;   // 보스 몬스터 데미지
  추가뎀?: number; // 상태이상 추가 데미지 + 조건부 데미지 (가동률 반영, 풀중첩 기준)
  // ── 곱연산 계열 ──
  방무?: number[];   // ∏(1−v/100)
  최종뎀?: number[]; // ∏(1+v/100)
  // ── 크리티컬 ──
  크확?: number;
  크뎀?: number;
  // ── HP ──
  HP?: number;
  HP미적용?: number;
  'HP%'?: number;

  쿨감?: number; // 재사용 대기시간 감소 (초)
}

export interface GearStats {
  모자?: StatBlock;
  얼굴장식?: StatBlock;
  눈장식?: StatBlock;
  귀고리?: StatBlock;
  상의?: StatBlock;
  하의?: StatBlock;
  신발?: StatBlock;
  장갑?: StatBlock;
  망토?: StatBlock;
  무기?: StatBlock;
  보조무기?: StatBlock;
  엠블렘?: StatBlock;
  반지1?: StatBlock;
  반지2?: StatBlock;
  반지3?: StatBlock;
  반지4?: StatBlock;
  펜던트?: StatBlock;
  펜던트2?: StatBlock;
  벨트?: StatBlock;
  어깨장식?: StatBlock;
  포켓아이템?: StatBlock;
  훈장?: StatBlock;
  뱃지?: StatBlock;
  기계심장?: StatBlock;
  칭호?: StatBlock;
}

export interface LinkSkillStats {
  // ── 모험가 ──
  '인빈서블 빌리프'?: StatBlock;       // 전사
  '임피리컬 널리지'?: StatBlock;       // 마법사
  '어드벤쳐러 큐리어스'?: StatBlock;   // 궁수
  '시프 커닝'?: StatBlock;             // 도적
  '파이렛 블레스'?: StatBlock;         // 해적
  // ── 시그너스 기사단 ──
  '시그너스 블레스'?: StatBlock;       // 시그너스 공통
  '빛의 수호'?: StatBlock;             // 미하일
  // ── 레지스탕스 / 데몬 ──
  '스피릿 오브 프리덤'?: StatBlock;    // 레지스탕스 공통
  '하이브리드 로직'?: StatBlock;       // 제논
  '데몬스 퓨리'?: StatBlock;           // 데몬슬레이어
  '와일드 레이지'?: StatBlock;         // 데몬어벤져
  // ── 영웅 ──
  '콤보킬 어드밴티지'?: StatBlock;     // 아란
  '룬 퍼시스턴스'?: StatBlock;         // 에반
  퍼미에이트?: StatBlock;              // 루미너스
  '엘프의 축복'?: StatBlock;           // 메르세데스
  '데들리 인스팅트'?: StatBlock;       // 팬텀
  '구사 일생'?: StatBlock;             // 은월
  // ── 노바 ──
  '아이언 윌'?: StatBlock;             // 카이저
  '인텐시브 인썰트'?: StatBlock;       // 카데나
  '소울 컨트랙트'?: StatBlock;         // 엔젤릭버스터
  '프라이어 프리퍼레이션'?: StatBlock; // 카인
  // ── 레프 ──
  노블레스?: StatBlock;                // 아델
  '전투의 흐름'?: StatBlock;           // 일리움
  무아?: StatBlock;                    // 아크
  '이네이트 기프트'?: StatBlock;       // 칼리
  // ── 아니마 ──
  자신감?: StatBlock;                  // 호영
  '자연의 벗'?: StatBlock;             // 라라
  강체?: StatBlock;                    // 렌
  // ── 기타 ──
  '륀느의 축복'?: StatBlock;           // 제로
  판단?: StatBlock;                    // 키네시스
  커버넌트?: StatBlock;                // 레테
}

export interface CharacterStats {
  기본: StatBlock;        // 캐릭터 기본 스탯 (AP 외 베이스)
  AP: StatBlock;          // AP 배분
  메이플용사?: number;    // 메용이 올려주는 퍼센트 ex) 15~16
  크리티컬리인포스?: number; // 현재 크확의 N%만큼 크뎀 증가 — 그 N (미보유면 없음)
  장비?: GearStats;
  세트효과?: Record<string, StatBlock>;
  심볼?: StatBlock;
  하이퍼스탯?: StatBlock;
  어빌리티?: StatBlock;
  유니온?: StatBlock;     // 공격대원(미적용)+점령+전투 스탯 — 적용 여부는 미적용 키로 구분
  아티팩트?: StatBlock;   // 유니온 아티팩트
  챔피언?: StatBlock;     // 유니온 챔피언 뱃지
  성향?: StatBlock;       // 카리스마 → 방무

  스킬_0차?: Record<string, StatBlock>;
  스킬_1차?: Record<string, StatBlock>;
  스킬_2차?: Record<string, StatBlock>;
  스킬_3차?: Record<string, StatBlock>;
  스킬_4차?: Record<string, StatBlock>;
  스킬_하이퍼?: Record<string, StatBlock>;
  스킬_5차?: Record<string, StatBlock>;
  링크스킬?: LinkSkillStats;
  길드스킬?: StatBlock;
  헥사스탯?: StatBlock;

  도핑?: StatBlock;

  챌린저스?: StatBlock;   // 챌린저스 서버 상시 버프 (비챌린저스면 없음)
  버닝?: StatBlock;       // 버닝 BEYOND/하이퍼 버닝 MAX
}
