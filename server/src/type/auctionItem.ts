// 거래소 검색 응답의 매물 한 건. 필드·값은 실측 응답에서 왔다 —
// 장비는 아케인셰이드 스태프(toolTipType 4), 비장비는 MVP 추가 경험치 50% 쿠폰(toolTipType 5).
// 넥슨이 주는 필드는 훨씬 많지만 여기엔 우리가 실제로 읽는 것만 둔다 — 안 읽는 필드를 적어두면
// 실측한 적 없는 타입이 실측한 척 섞인다.
//
// toolTip은 toolTipType에 따라 내용이 갈린다. 4(장비)는 categories·reqJob·stat·upgradeInfo를 주고
// 5(비장비)는 그 중 아무것도 없이 tradeDescs·itemDesc를 준다 → toolTip 필드는 전부 옵셔널.
// 다만 어느 필드가 어느 쪽 "전용"인지는 단정하지 않는다 — timeLimit처럼 양쪽에 다 붙는 게 있다.

// toolTip.stat 및 그 분해 블록(baseStat·starforceStat·upgradeStat·exOptionStat·timeLimitedStat).
// 여기만은 키 전체를 적는다 — 실측 응답에서 이 30개가 고정으로, 없는 옵션도 0으로 와서
// 모양이 확정된 유일한 자리다. 우리가 읽는 건 이 중 11개뿐이지만 나머지도 실측값이다.
// interface가 아니라 type인 건 statLine이 키로 인덱싱하기 때문 — type만 암묵적 인덱스 시그니처가 붙는다.
export type AuctionItemStat = {
  reduceReq?: number; // 착용 레벨 감소
  incReq?: number;
  arc?: number; // 아케인포스
  aut?: number; // 어센틱포스
  str?: number;
  dex?: number;
  int?: number;
  luk?: number;
  all?: number; // 올스탯%
  mhp?: number;
  mmp?: number;
  hpr?: number;
  mpr?: number;
  mdf?: number;
  pad?: number; // 공격력
  mad?: number; // 마력
  pdd?: number; // 방어력
  speed?: number;
  jump?: number;
  dam?: number; // 데미지%
  bdr?: number; // 보스 몬스터 데미지%
  imdr?: number; // 몬스터 방어율 무시%
  addExpr?: number;
  expRate?: number;
  srExpRate?: number;
  srMesoRate?: number;
  srDropRate?: number;
  pqExpRate?: number;
  chuc?: number; // 스타포스 강화 횟수
  craft?: number;
}

export interface AuctionOptionEntry {
  grade?: number;
  text?: string | null;
}

export interface AuctionPotential {
  grade: number;
  entries?: AuctionOptionEntry[];
  description: string;
}

export interface AuctionToolTip {
  itemName?: string; // 매물의 itemName과 같은 값이 툴팁에도 온다
  categories?: string[] | null; // 부위 판단 근거. 예: ["무기","한손","스태프"], ["장신구","반지"], ["어깨장식"]
  reqJob?: string | null; // 직업군까지만 말한다. 예: "마법사". 직업 제한이 없으면 null
  unwearableJobNames?: string[] | null; // 같은 직업군 안의 예외. 예: ["키네시스","일리움","라라","레테"]
  stat?: AuctionItemStat;
  upgradeInfo?: {
    scroll?: { current: number; remaining: number; failure: number; max: number };
    exOption?: { entries?: AuctionOptionEntry[] };
    potential?: AuctionPotential;
    additionalPotential?: AuctionPotential;
  };
  exceptionalUpgrade?: { entries?: AuctionOptionEntry[] } | null;
  soulWeapon?: { status?: string; soulName?: string | null; optionText?: string | null; skillName?: string | null } | null;
  tradeDesc?: string[] | null; // 장비(toolTipType 4)
  tradeDescs?: string[] | null; // 비장비(toolTipType 5). 없으면 빈 배열로 온다
  isAmazingHyperUpgradeUsed?: boolean;
  timeLimit?: string | null; // 기간제. 예: "2026년 8월 14일 19시 59분까지 사용가능". 장비에도 붙는다
}

// 필수/옵셔널의 기준은 "실측 응답에 있었나"가 아니다 — 매물 종류가 장비·비장비 말고도 많아서
// 표본 두 개로 "항상 온다"를 못 말한다. 요약이 값 없이는 못 만드는 필드만 필수로 둔다.
export interface AuctionItem {
  _id: string;
  itemName: string;
  pricePerItem: string; // 메소. 문자열로 온다
  quantity: number;
  starforce: number;
  status: string; // "ON_SALE" | "SOLD"
  endDate: string;
  wishlistCount: number;
  attackPowerDiff?: number | null; // 전투력 증감. 0은 유효한 값(현재 장비와 동급)
  seedRingLevel?: number;
  gender?: string; // "MALE" | "FEMALE" | "NONE"
  royalSpecialType?: number; // 코디 라벨 등급. 없으면 0
  petGrade?: number; // 펫 등급. 없으면 0
  tradeDate?: string | null;
  isMyWorld?: boolean;
  toolTip?: AuctionToolTip;
}

export interface AuctionSearchResponse {
  total: number;
  page: number;
  totalPages: number;
  hasNext: boolean;
  searchKey: string;
  items?: AuctionItem[];
}
