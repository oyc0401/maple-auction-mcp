export interface StatBlock {
  STR?: number;
  DEX?: number;
  INT?: number;
  LUK?: number;
  STR미적용?: number;
  DEX미적용?: number;
  INT미적용?: number;
  LUK미적용?: number;
  'STR%'?: number;
  'DEX%'?: number;
  'INT%'?: number;
  'LUK%'?: number;
  올스탯?: number;
  올스탯미적용?: number;
  '올스탯%'?: number;
  레벨당STR?: number;
  레벨당DEX?: number;
  레벨당INT?: number;
  레벨당LUK?: number;
  공격력?: number;
  마력?: number;
  '공격력%'?: number;
  '마력%'?: number;
  데미지?: number;
  보공?: number;
  추가뎀?: number;
  방무?: number[];
  최종뎀?: number[];
  크확?: number;
  크뎀?: number;
  HP?: number;
  HP미적용?: number;
  'HP%'?: number;

  쿨감?: number;
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
  '인빈서블 빌리프'?: StatBlock;
  '임피리컬 널리지'?: StatBlock;
  '어드벤쳐러 큐리어스'?: StatBlock;
  '시프 커닝'?: StatBlock;
  '파이렛 블레스'?: StatBlock;
  '시그너스 블레스'?: StatBlock;
  '빛의 수호'?: StatBlock;
  '스피릿 오브 프리덤'?: StatBlock;
  '하이브리드 로직'?: StatBlock;
  '데몬스 퓨리'?: StatBlock;
  '와일드 레이지'?: StatBlock;
  '콤보킬 어드밴티지'?: StatBlock;
  '룬 퍼시스턴스'?: StatBlock;
  퍼미에이트?: StatBlock;
  '엘프의 축복'?: StatBlock;
  '데들리 인스팅트'?: StatBlock;
  '구사 일생'?: StatBlock;
  '아이언 윌'?: StatBlock;
  '인텐시브 인썰트'?: StatBlock;
  '소울 컨트랙트'?: StatBlock;
  '프라이어 프리퍼레이션'?: StatBlock;
  노블레스?: StatBlock;
  '전투의 흐름'?: StatBlock;
  무아?: StatBlock;
  '이네이트 기프트'?: StatBlock;
  자신감?: StatBlock;
  '자연의 벗'?: StatBlock;
  강체?: StatBlock;
  '륀느의 축복'?: StatBlock;
  판단?: StatBlock;
  커버넌트?: StatBlock;
}

export interface CharacterStats {
  기본: StatBlock;
  AP: StatBlock;
  메이플용사?: number;
  크리티컬리인포스?: number;
  장비?: GearStats;
  세트효과?: Record<string, StatBlock>;
  심볼?: StatBlock;
  하이퍼스탯?: StatBlock;
  어빌리티?: StatBlock;
  유니온?: StatBlock;
  아티팩트?: StatBlock;
  챔피언?: StatBlock;
  성향?: StatBlock;

  스킬_0차?: Record<string, StatBlock>;
  스킬_1차?: Record<string, StatBlock>;
  스킬_2차?: Record<string, StatBlock>;
  스킬_3차?: Record<string, StatBlock>;
  스킬_4차?: Record<string, StatBlock>;
  스킬_하이퍼?: Record<string, StatBlock>;
  스킬_5차?: Record<string, StatBlock>;
  링크스킬?: LinkSkillStats;
  길드스킬?: StatBlock;
  캐시장비?: StatBlock;
  헥사스탯?: StatBlock;

  도핑?: StatBlock;

  챌린저스?: StatBlock;
  버닝?: StatBlock;
  불릿?: StatBlock;
}
