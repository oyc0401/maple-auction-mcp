// 스탯 버킷의 명명 상수 — 값은 StatBlock 키와 1:1.
export enum MapleStat {
  STR = 'STR',
  DEX = 'DEX',
  INT = 'INT',
  LUK = 'LUK',
  STR미적용 = 'STR미적용',
  DEX미적용 = 'DEX미적용',
  INT미적용 = 'INT미적용',
  LUK미적용 = 'LUK미적용',
  STR퍼 = 'STR퍼',
  DEX퍼 = 'DEX퍼',
  INT퍼 = 'INT퍼',
  LUK퍼 = 'LUK퍼',
  올스탯 = '올스탯',
  올스탯미적용 = '올스탯미적용',
  올스탯퍼 = '올스탯퍼',
  공격력 = '공격력',
  마력 = '마력',
  공격력퍼 = '공격력퍼',
  마력퍼 = '마력퍼',
  데미지 = '데미지',
  보공 = '보공',
  추가뎀 = '추가뎀',
  방무 = '방무', // 곱연산 — UserStat에선 계수 배열에 push
  최종뎀 = '최종뎀', // 곱연산 — UserStat에선 계수 배열에 push
  크확 = '크확',
  크뎀 = '크뎀',
  HP = 'HP',
  HP미적용 = 'HP미적용',
  HP퍼 = 'HP퍼',
}

export interface StatBlock {
  STR?: number;
  DEX?: number;
  INT?: number;
  LUK?: number;
  STR미적용?: number;
  DEX미적용?: number;
  INT미적용?: number;
  LUK미적용?: number;
  STR퍼?: number;
  DEX퍼?: number;
  INT퍼?: number;
  LUK퍼?: number;
  올스탯?: number;
  올스탯미적용?: number;
  올스탯퍼?: number;
  레벨당STR?: number;
  레벨당DEX?: number;
  레벨당INT?: number;
  레벨당LUK?: number;
  공격력?: number;
  마력?: number;
  공격력퍼?: number;
  마력퍼?: number;
  데미지?: number;
  보공?: number;
  추가뎀?: number;
  방무?: number[];
  최종뎀?: number[];
  크확?: number;
  크뎀?: number;
  HP?: number;
  HP미적용?: number;
  HP퍼?: number;

  쿨감?: number;
}

export interface EquippedItem {
  name: string;
  stat: StatBlock;
}

export interface GearStats {
  모자?: EquippedItem;
  얼굴장식?: EquippedItem;
  눈장식?: EquippedItem;
  귀고리?: EquippedItem;
  상의?: EquippedItem;
  한벌옷?: EquippedItem;
  하의?: EquippedItem;
  신발?: EquippedItem;
  장갑?: EquippedItem;
  망토?: EquippedItem;
  무기?: EquippedItem;
  보조무기?: EquippedItem;
  엠블렘?: EquippedItem;
  반지1?: EquippedItem;
  반지2?: EquippedItem;
  반지3?: EquippedItem;
  반지4?: EquippedItem;
  펜던트?: EquippedItem;
  펜던트2?: EquippedItem;
  벨트?: EquippedItem;
  어깨장식?: EquippedItem;
  포켓아이템?: EquippedItem;
  훈장?: EquippedItem;
  뱃지?: EquippedItem;
  기계심장?: EquippedItem;
  칭호?: EquippedItem;
}

export type CashGearStats = Record<string, EquippedItem>;

export interface SkillStats {
  스킬_1차?: Record<string, StatBlock>;
  스킬_2차?: Record<string, StatBlock>;
  스킬_3차?: Record<string, StatBlock>;
  스킬_4차?: Record<string, StatBlock>;
  스킬_하이퍼_패시브?: Record<string, StatBlock>;
  스킬_하이퍼_액티브?: Record<string, StatBlock>;
  스킬_5차?: Record<string, StatBlock>;
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
  union_raider?: StatBlock;
  union_state?: StatBlock;
  아티팩트?: StatBlock;
  챔피언?: StatBlock;
  성향?: StatBlock;

  스킬_0차?: Record<string, StatBlock>;
  스킬?: SkillStats;
  링크스킬?: Record<string, StatBlock>;
  길드스킬?: StatBlock;
  헥사스탯?: StatBlock;

  캐시장비?: CashGearStats;
  펫장비?: StatBlock;

  도핑?: StatBlock;
}
