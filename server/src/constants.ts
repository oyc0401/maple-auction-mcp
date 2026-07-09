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
