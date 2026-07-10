// 실측 상수 (2026-07-08, auction.maplestory.nexon.com 번들 + POST 캡처로 확인)

// 월드 ID → 이름 (번들 내 월드 목록 실측)
export const WORLD_NAMES: Record<number, string> = {
  0: '스카니아',
  1: '베라',
  3: '루나',
  4: '제니스',
  5: '크로아',
  10: '유니온',
  16: '엘리시움',
  29: '이노시스',
  43: '레드',
  44: '오로라',
  45: '에오스',
  46: '헬리오스',
  48: '챌린저스2',
  49: '챌린저스',
  50: '아케인',
  51: '노바',
  52: '챌린저스3',
  54: '챌린저스4',
};

export const KNOWN_WORLD_IDS = Object.keys(WORLD_NAMES).map(Number);

export function worldName(id: number): string {
  return WORLD_NAMES[id] ?? `월드 ${id}`;
}

// 직업군 (POST itemCategory.itemJobCategory 실측: THIEF)
export const JOB_CLASSES = ['WARRIOR', 'MAGE', 'ARCHER', 'THIEF', 'PIRATE'] as const;
export type JobClass = (typeof JOB_CLASSES)[number];

// 잠재/에디셔널 옵션 키 (실측: potentialOptionSum { physicalAttackPercent: 9 })
// *PerLevel 4종은 에디셔널 전용.
export const POTENTIAL_OPTION_LABELS: Record<string, string> = {
  bossDamagePercent: '보스 몬스터 데미지 %',
  ignoreMonsterDefense: '몬스터 방어율 무시 %',
  damagePercent: '데미지 %',
  physicalAttackPercent: '공격력 %',
  magicAttackPercent: '마력 %',
  allStatsPercent: '올스탯 %',
  strPercent: 'STR %',
  dexPercent: 'DEX %',
  intPercent: 'INT %',
  lukPercent: 'LUK %',
  criticalPercent: '크리티컬 확률',
  statusResistance: '상태 이상 내성',
  elementalResistance: '모든 속성 내성',
  criticalDamagePercent: '크리티컬 데미지',
  skillCooldownReduction: '스킬 재사용 대기시간 감소',
  itemDropPercent: '아이템 획득 확률',
  maxHpPercent: 'MaxHP %',
  maxMpPercent: 'MaxMP %',
  physicalAttack: '공격력 (수치)',
  magicAttack: '마력 (수치)',
  str: 'STR',
  dex: 'DEX',
  int: 'INT',
  luk: 'LUK',
  maxHp: 'MaxHP',
  maxMp: 'MaxMP',
  allStats: '올스탯',
  skillLevelIncrease: '4차 이하 스킬 레벨',
  hpRecovery: '공격 시 HP 회복',
  mpRecovery: '공격 시 MP 회복',
  hpRecoveryRate: 'HP 회복 효율',
  mesosObtainedPercent: '메소 획득량',
  hasteSkill: '쓸만한 헤이스트',
  mysticDoorSkill: '쓸만한 미스틱 도어',
  sharpEyesSkill: '쓸만한 샤프 아이즈',
  hyperBodySkill: '쓸만한 하이퍼 바디',
  combatOrdersSkill: '쓸만한 컴뱃 오더스',
  advancedBlessSkill: '쓸만한 어드밴스드 블레스',
  windBoosterSkill: '쓸만한 윈드 부스터',
  strPerLevel: '9레벨 당 STR (에디셔널 전용)',
  dexPerLevel: '9레벨 당 DEX (에디셔널 전용)',
  intPerLevel: '9레벨 당 INT (에디셔널 전용)',
  lukPerLevel: '9레벨 당 LUK (에디셔널 전용)',
};
export const POTENTIAL_OPTION_KEYS = Object.keys(POTENTIAL_OPTION_LABELS);

// 추가 옵션 키 (실측: enhancementOption 바로 아래 exMaxHp: 1)
export const EX_OPTION_LABELS: Record<string, string> = {
  exStr: 'STR',
  exDex: 'DEX',
  exInt: 'INT',
  exLuk: 'LUK',
  exPhysicalAttack: '공격력',
  exMagicAttack: '마력',
  exBossDamagePercent: '보스 데미지 %',
  exDamagePercent: '데미지 %',
  exAllStatsPercent: '올스탯 %',
  exMaxHp: '최대 HP',
  exMaxMp: '최대 MP',
  exReducedLevelReq: '착용 제한 레벨 감소',
};
export const EX_OPTION_KEYS = Object.keys(EX_OPTION_LABELS);

// 주문서 강화 키 (실측: enhancementOption 바로 아래 scrollPhysicalAttack: 1)
export const SCROLL_OPTION_LABELS: Record<string, string> = {
  scrollStr: 'STR',
  scrollDex: 'DEX',
  scrollInt: 'INT',
  scrollLuk: 'LUK',
  scrollMaxHp: 'MaxHP',
  scrollMaxMp: 'MaxMP',
  scrollPhysicalAttack: '공격력',
  scrollMagicAttack: '마력',
};
export const SCROLL_OPTION_KEYS = Object.keys(SCROLL_OPTION_LABELS);

// 소비 하위 분류 (itemDetailCategory). 번들 카테고리 트리 실측 (2026-07-10).
// CONSUME(전체)는 결과 과다로 API가 422(code 4040)를 반환할 수 있다 — 하위 분류·키워드로 좁혀야 함.
export const CONSUME_CATEGORY_LABELS: Record<string, string> = {
  CONSUME: '소비 전체 (결과 과다 시 422 거부됨)',
  CONSUME_POTION: '회복 아이템 전체',
  CONSUME_POTION_POTION: '회복 아이템',
  CONSUME_POTION_CURE: '상태 이상 회복',
  CONSUME_ALCHEMY: '연금술 아이템 전체',
  CONSUME_ALCHEMY_POTION: '연금술 회복',
  CONSUME_ALCHEMY_ELIXER: '비약',
  CONSUME_ALCHEMY_BUFF: '버프',
  CONSUME_SCROLL: '주문서 전체',
  CONSUME_SCROLL_ARMOR: '방어구/장신구 주문서',
  CONSUME_SCROLL_WEAPON: '무기 주문서',
  CONSUME_SCROLL_ENCHANT: '장비 강화/잠재 주문서',
  CONSUME_SCROLL_WHITE: '백의/혼돈의 주문서',
  CONSUME_SCROLL_FLAME: '환생의 불꽃',
  CONSUME_SCROLL_PET: '펫 주문서',
  CONSUME_SCROLL_ETC: '기타 주문서',
  CONSUME_RECIPE: '전문기술 레시피 전체',
  CONSUME_RECIPE_EQUIP: '장비 레시피',
  CONSUME_RECIPE_ACCESSORY: '장신구 레시피',
  CONSUME_RECIPE_ALCHEMY: '연금술 레시피',
  CONSUME_SKILL_BOOK: '스킬북',
  CONSUME_ETC: '소비 기타 전체',
  CONSUME_ETC_MOVE_MAP: '맵 이동 아이템',
  CONSUME_ETC_ARROW: '화살/표창',
  CONSUME_ETC_ETC: '소비 기타',
};
export const CONSUME_CATEGORY_KEYS = Object.keys(CONSUME_CATEGORY_LABELS);

// 캐시 하위 분류 (itemDetailCategory). CASH(전체)도 결과 과다 422 가능.
export const CASH_CATEGORY_LABELS: Record<string, string> = {
  CASH: '캐시 전체 (결과 과다 시 422 거부됨)',
  CASH_ENCHANT: '강화 전체',
  CASH_ENCHANT_CUBE: '큐브',
  CASH_ENCHANT_SCROLL: '강화 주문서',
  CASH_GAME: '게임 전체',
  CASH_GAME_CONVENIENCE: '편의',
  CASH_GAME_SHOP: '상점',
  CASH_GAME_MESSENGER: '메신저',
  CASH_GAME_WEATHER_EFFECT: '기상효과',
  CASH_COORDINATION: '코디 전체',
  CASH_COORDINATION_COUPON: '코디 쿠폰',
  CASH_COORDINATION_WEAPON: '코디 무기',
  CASH_COORDINATION_CAP: '코디 모자',
  CASH_COORDINATION_CAPE: '코디 망토',
  CASH_COORDINATION_LONGCOAT: '코디 한벌옷',
  CASH_COORDINATION_COAT: '코디 상의',
  CASH_COORDINATION_PANTS: '코디 하의',
  CASH_COORDINATION_SHOES: '코디 신발',
  CASH_COORDINATION_GLOVE: '코디 장갑',
  CASH_COORDINATION_FACE: '코디 얼굴장식',
  CASH_COORDINATION_EAR: '코디 귀장식',
  CASH_COORDINATION_RING: '코디 반지',
  CASH_COORDINATION_EYE: '코디 눈장식',
  CASH_COORDINATION_EFFECT: '코디 이펙트',
  CASH_COORDINATION_SHIELD: '코디 방패',
  CASH_BEAUTY: '뷰티 전체',
  CASH_BEAUTY_HAIR: '헤어',
  CASH_BEAUTY_COSMETIC: '성형',
  CASH_BEAUTY_EMOTION: '감정표현',
  CASH_BEAUTY_ETC: '뷰티 기타',
  CASH_PET: '펫 전체',
  CASH_PET_PET: '펫',
  CASH_PET_PET_EQUIP: '펫장비',
  CASH_PET_PET_FOOD: '펫먹이',
  CASH_PET_PET_SKILL: '펫스킬',
  CASH_ETC: '캐시 기타',
};
export const CASH_CATEGORY_KEYS = Object.keys(CASH_CATEGORY_LABELS);

// 기타 하위 분류 (itemDetailCategory). 재료류(주문의 정수 등)는 ETC 전체에만 잡힌다.
export const ETC_CATEGORY_LABELS: Record<string, string> = {
  ETC: '기타 전체 (재료류 포함)',
  ETC_CHAIR: '의자',
  ETC_SUBJOB: '전문기술',
};
export const ETC_CATEGORY_KEYS = Object.keys(ETC_CATEGORY_LABELS);

// 캐시 기간제 옵션 키 (실측 2026-07-10: filters.cashOption 바로 아래 { periodStr: 11 })
export const CASH_PERIOD_OPTION_LABELS: Record<string, string> = {
  periodStr: 'STR',
  periodDex: 'DEX',
  periodInt: 'INT',
  periodLuk: 'LUK',
  periodMaxHp: '최대 HP',
  periodMaxMp: '최대 MP',
  periodPhysicalAttack: '공격력',
  periodMagicAttack: '마력',
  periodDefense: '방어력',
  periodJump: '점프력',
  periodSpeed: '이동속도',
};
export const CASH_PERIOD_OPTION_KEYS = Object.keys(CASH_PERIOD_OPTION_LABELS);

// 코디 라벨 등급 → basicOption.royalSpecialType (실측: 블랙라벨 = 2)
export const ROYAL_LABEL_GRADES: Record<string, number> = {
  일반: 0,
  레드라벨: 1,
  블랙라벨: 2,
  스페셜라벨: 3,
  마스터라벨: 4,
};
export const ROYAL_LABEL_KEYS = Object.keys(ROYAL_LABEL_GRADES);

// 펫 등급 → basicOption.petGrade (번들 실측: NORMAL 0 / BLACK 1 / SWEET 4 / DREAM 5 / PETITE 6)
export const PET_GRADES: Record<string, number> = {
  일반: 0,
  '원더 블랙': 1,
  '루나 스윗': 4,
  '루나 드림': 5,
  '루나 쁘띠': 6,
};
export const PET_GRADE_KEYS = Object.keys(PET_GRADES);

// 숫자 등급 → 라벨 역매핑 (응답 요약용)
export const ROYAL_LABEL_BY_VALUE: Record<number, string> = Object.fromEntries(
  Object.entries(ROYAL_LABEL_GRADES).map(([k, v]) => [v, k])
);
export const PET_GRADE_BY_VALUE: Record<number, string> = Object.fromEntries(
  Object.entries(PET_GRADES).map(([k, v]) => [v, k])
);

// 방어구 하위 분류 (itemDetailCategory). 상위 코드(ARMOR_ARMOR 등)도 그대로 유효.
export const ARMOR_CATEGORY_LABELS: Record<string, string> = {
  ARMOR: '방어구+장신구 전체',
  ARMOR_ARMOR: '방어구 전체',
  ARMOR_ARMOR_CAP: '모자',
  ARMOR_ARMOR_COAT: '상의',
  ARMOR_ARMOR_LONGCOAT: '한벌옷',
  ARMOR_ARMOR_PANTS: '하의',
  ARMOR_ARMOR_SHOES: '신발',
  ARMOR_ARMOR_GLOVE: '장갑',
  ARMOR_ARMOR_SHIELD: '방패',
  ARMOR_ARMOR_CAPE: '망토',
  ARMOR_ACCESSORY: '장신구 전체',
  ARMOR_ACCESSORY_FACE: '얼굴장식',
  ARMOR_ACCESSORY_EYE: '눈장식',
  ARMOR_ACCESSORY_EAR: '귀고리',
  ARMOR_ACCESSORY_RING: '반지',
  ARMOR_ACCESSORY_PENDANT: '펜던트',
  ARMOR_ACCESSORY_BELT: '벨트',
  ARMOR_ACCESSORY_MEDAL: '훈장',
  ARMOR_ACCESSORY_SHOULDER: '어깨장식',
  ARMOR_ACCESSORY_POCKET: '포켓 아이템',
  ARMOR_ACCESSORY_BADGE: '뱃지',
  ARMOR_ACCESSORY_EMBLEM: '엠블렘',
  ARMOR_ACCESSORY_POWER_SOURCE: '파워소스',
  ARMOR_ETC: '방어구 기타',
  ARMOR_ETC_MECHANIC: '메카닉 장비',
  ARMOR_ETC_ANDROID: '안드로이드',
  ARMOR_ETC_MACHINE_HEART: '기계 심장',
  ARMOR_ETC_DRAGON_CAP: '드래곤 장비',
};
export const ARMOR_CATEGORY_KEYS = Object.keys(ARMOR_CATEGORY_LABELS);

// 무기 하위 분류 (itemDetailCategory). WEAPON(전체)은 기존 검증값.
export const WEAPON_CATEGORY_LABELS: Record<string, string> = {
  WEAPON: '무기 전체',
  WEAPON_ONE_HANDED: '한손무기 전체',
  WEAPON_ONE_HANDED_SWORD: '한손검',
  WEAPON_ONE_HANDED_AXE: '한손도끼',
  WEAPON_ONE_HANDED_MACE: '한손둔기',
  WEAPON_ONE_HANDED_DAGGER: '단검',
  WEAPON_ONE_HANDED_CANE: '케인',
  WEAPON_ONE_HANDED_WAND: '완드',
  WEAPON_ONE_HANDED_STAFF: '스태프',
  WEAPON_ONE_HANDED_SHINING_ROD: '샤이닝 로드',
  WEAPON_ONE_HANDED_SOUL_SHOOTER: '소울 슈터',
  WEAPON_ONE_HANDED_DESPERADO: '데스페라도',
  WEAPON_ONE_HANDED_ENERGY_SWORD: '에너지소드',
  WEAPON_ONE_HANDED_ESP_LIMITER: 'ESP 리미터',
  WEAPON_ONE_HANDED_CHAIN: '체인',
  WEAPON_ONE_HANDED_MAGIC_GAUNTLET: '매직 건틀렛',
  WEAPON_ONE_HANDED_FAN: '부채',
  WEAPON_ONE_HANDED_TUNER: '튜너',
  WEAPON_ONE_HANDED_BREATH_SHOOTER: '브레스 슈터',
  WEAPON_ONE_HANDED_LONG_SWORD: '롱소드',
  WEAPON_ONE_HANDED_SCROLL: '두루마리',
  WEAPON_TWO_HANDED: '두손무기 전체',
  WEAPON_TWO_HANDED_SWORD: '두손검',
  WEAPON_TWO_HANDED_AXE: '두손도끼',
  WEAPON_TWO_HANDED_MACE: '두손둔기',
  WEAPON_TWO_HANDED_SPEAR: '창',
  WEAPON_TWO_HANDED_POLEARM: '폴암',
  WEAPON_TWO_HANDED_BOW: '활',
  WEAPON_TWO_HANDED_CROSSBOW: '석궁',
  WEAPON_TWO_HANDED_THROWING_GLOVE: '아대',
  WEAPON_TWO_HANDED_KNUCKLE: '너클',
  WEAPON_TWO_HANDED_GUN: '건',
  WEAPON_TWO_HANDED_DUAL_BOW: '듀얼 보우건',
  WEAPON_TWO_HANDED_HAND_CANNON: '핸드캐넌',
  WEAPON_TWO_HANDED_GAUNTLET_REVOLVER: '건틀렛 리볼버',
  WEAPON_TWO_HANDED_ANCIENT_BOW: '에인션트 보우',
  WEAPON_TWO_HANDED_CHAKRAM: '차크람',
  WEAPON_SUB: '보조무기 전체',
} as const;
export const WEAPON_CATEGORY_KEYS = Object.keys(WEAPON_CATEGORY_LABELS);

// 구매 한도 (메소). env·설정 오버라이드 없음 — AI 우회 경로 차단.
// 세션 상향(raise_limit)은 AuctionService 메모리에만 존재하며 프로세스 재시작 시 이 값으로 복귀.
export const BUY_LIMIT_MESO = 100_000_000;
