// maplescouter POST /api/calc/dmg-simulator 요청 바디 타입 — TS-native 숫자 표현.
// 실측 소스: ./dmg-simulator-payload, ./dmg-simulator-weapon-payload
//   - 두 샘플의 키 구조는 완전히 동일(깊은 키 대조 100% 일치). weapon 샘플은 무기 교체라
//     simulator 델타가 여러 축에 동시에 들어간 것일 뿐 shape는 같다.
//   - userStat 블록은 GET /api/id 응답의 userStat과 203키 전부 일치 → 그대로 복사해 넣는다.
//
// ⚠️ 원 API는 대부분의 수치를 "문자열"("270", "-40", "10.00000")로 주고받는다. 이 인터페이스는
//    TS 안에서 값을 계산·생성하기 위한 number 표현이므로, POST 전송 직전에 문자열로 직렬화해야
//    한다(예: 각 필드 String(v), 빈 슬롯은 ""). number인 곳은 원본 JSON에서도 number다
//    (power.*, hexa.hexaStat, seedRing.*.efficiency).
//    "// 미사용=0" 표시 필드는 원본에서 빈 문자열("")로 오는 슬롯 — 직렬화 시 0을 ""로 바꾼다.

// ── userStat 하위 블록 ───────────────────────────────────────────────

/** 도핑(버프) 온/오프. 대부분 boolean, 일부만 단계·수치. */
export interface Doping {
  bigHero: boolean;
  greatIgnoreGuard: boolean;
  dragonsMeal: boolean;
  extreme: boolean;
  fish: boolean;
  guildBlessing: boolean;
  jangBi: boolean;
  legendHero: boolean;
  legendHp: boolean;
  rebootAtkPotion: boolean;
  shiningRed: boolean;
  shiningBlue: boolean;
  statPotion: boolean;
  stat: number;
  superPower: boolean;
  unionsPower: boolean;
  urus: boolean;
  heroesHawl: boolean;
  noblessBoss: boolean;
  noblessDmg: boolean;
  noblessCriDmg: boolean;
  noblessIgnore: boolean;
  nobless: number[];
  sayram: boolean;
  collector: boolean;
  buff275: boolean;
  additional1: boolean;
  additional2: boolean;
  championAll: number;
  championAtk: number;
  championBoss: number;
  championIgnore: number;
  championCriDmg: number;
  authenticDmg: boolean;
  moonshine: boolean;
  cake: boolean;
  apple: boolean;
  tengu: boolean;
  candy: boolean;
  house: boolean;
  wedding: boolean;
  specialWedding: boolean;
  whiteBear: boolean;
  ultraVip: boolean;
  superVip: boolean;
  truffle: boolean;
  medal: boolean;
  hyperRainbow: boolean;
  rainbow: boolean;
  thanks: boolean;
  genePass: boolean;
}

/** 링크 스킬 단계(직업 키 → 단계). */
export interface LinkSkill {
  ark: number;
  illium: number;
  kadena: number;
  kain: number;
  magician: number;
  thief: number;
  angel: number;
  hoyoung: number;
  mukhyun: number;
  mihile: number;
  kaiser: number;
  hayato: number;
  kanna: number;
}

/** 특수 설정(리부트·소울·시드링 단계 등). */
export interface Special {
  isReboot: boolean;
  combat: boolean;
  epiSoul: number;
  mugongSoul: number;
  genesis: boolean;
  destiny: boolean;
  oneHandSword: boolean;
  useRuinForceShild: boolean;
  useContinuousRingAsMainRing: boolean;
  restraintRing: number;
  weaponRing: number;
  riskTaker: number;
  ringOfSum: number;
  statThird: number;
  statFourth: number;
  continuosRing: number;
  challenge: boolean;
  is30min: boolean;
  destiny2ndSkill: boolean;
  famPassiveUp: boolean;
}

/** 캐릭터 스탯 시트(재구성된 resting 스탯). */
export interface ScouterStat {
  /** 직업명 — 유일하게 실제 텍스트. */
  myClass: string;
  level: number;
  mainStatBase: number;
  mainStatPer: number;
  mainStatAbs: number;
  subStatBase: number;
  subStatPer: number;
  subStatAbs: number;
  ssubStatBase: number;
  ssubStatPer: number;
  ssubStatAbs: number;
  arcaneForce: number;
  authenticForce: number;
  atkBase: number;
  atkAbs: number;
  dmg: number;
  bossDmg: number;
  normalDmg: number;
  ignoreDef: number;
  buffDuration: number;
  critical: number;
  criticalDmg: number;
  weaponAtk: number;
  atkPercent: number;
  coolTimeReducePercent: number;
  coolTimeReduce: number;
  wildhunterUnion: number;
  resetCoolDown: number;
  statusAdditionalDmg: number;
  passiveSkillLevelUp: boolean;
  increaseTarget: boolean;
  summonPersistTime: number;
  artifact_increaseTarget: boolean;
  artifact_finalAttack: number;
  subStat_hyper: number; // 미사용=0
  subStat_ability: number; // 미사용=0
  subStat_union: number; // 미사용=0
  subStat_doping: number; // 미사용=0
  subStat_afterDoping: number; // 미사용=0
  ssubStat_hyper: number; // 미사용=0
  ssubStat_ability: number; // 미사용=0
  ssubStat_union: number; // 미사용=0
  ssubStat_doping: number; // 미사용=0
  ssubStat_afterDoping: number; // 미사용=0
  ignoreElementalResist: number;
  maple_combatPower: number; // 미사용=0
  tms_fd: number;
}

/** 헥사 코어 레벨. */
export interface Hexa {
  skillCore1: number;
  skillCore2: number;
  masteryCore1: number;
  masteryCore2: number;
  masteryCore3: number;
  masteryCore4: number;
  reinCore1: number;
  reinCore2: number;
  reinCore3: number;
  reinCore4: number;
  generalCore2: number;
  generalCore3: number;
  hexaStat: number;
}

/** 시드링 1개의 레벨·효율. */
export interface SeedRingEntry {
  level: number;
  efficiency: number;
}

export interface SeedRing {
  restraintRing: SeedRingEntry;
  weaponRing: SeedRingEntry;
  ringOfSum: SeedRingEntry;
  riskTakerRing: SeedRingEntry;
  criDamageRing: SeedRingEntry;
  levelRing: SeedRingEntry;
  continuosRing: SeedRingEntry;
  ultiRing: SeedRingEntry;
  durabilityRing: SeedRingEntry;
}

/** 순수 스탯 총합(STR/DEX/INT/LUK). */
export interface EntireStat {
  str: number;
  dex: number;
  int: number;
  luk: number;
}

/** 전투력 계산용 파생값. */
export interface Power {
  mainStatBase: number;
  mainStatPer: number;
  mainStatAbs: number;
  subStatBase: number;
  subStatPer: number;
  subStatAbs: number;
  ssubStatBase: number;
  ssubStatPer: number;
  ssubStatAbs: number;
  atk: number;
  atkPer: number;
  bossDmg: number;
  criDmg: number;
}

/** 사냥 스킬 레벨. */
export interface HuntSkill {
  solJanus: number;
  erdaShower: number;
}

/**
 * 캐릭터 현재 상태 전체.
 * GET /api/id 응답의 `userStat`과 동일하며, POST 시 그대로 복사해 넣는다(변형 금지).
 */
export interface ScouterUserStat {
  doping: Doping;
  linkSkill: LinkSkill;
  special: Special;
  stat: ScouterStat;
  hexa: Hexa;
  seedRing: SeedRing;
  entireStat: EntireStat;
  isGMS: boolean;
  isTMS: boolean;
  isMSEA: boolean;
  isJMS: boolean;
  power: Power;
  huntSkill: HuntSkill;
}

// ── simulator 블록 ───────────────────────────────────────────────────

/**
 * 측정하려는 스탯 증감 델타. 전 축 0이면 "무변화"라 응답 boss stat이 GET /api/id 값과 일치.
 * 스캐폴딩 필드(weaponAtk·dopingSimul·linkSimul·링 5종·destiny2ndSkill)는 userStat에서
 * 복사한다(baseSimulator 참고). 링 필드 네이밍이 Special과 다름에 주의: `ringofSum`(소문자 of), `contiRing`.
 */
export interface DmgSimulator {
  mainStat: number;
  mainStatPer: number;
  mainStatAbs: number;
  subStat: number;
  subStatPer: number;
  subStatAbs: number;
  ssubStat: number;
  ssubStatPer: number;
  ssubStatAbs: number;
  allStatPer: number;
  criRate: number;
  buffDuration: number;
  coolTimeReduce: number;
  atk: number;
  atkPer: number;
  bossDmg: number;
  criDmg: number;
  ignoreGuard: number;
  genesis: boolean;
  mainStat9Level: number; // 미사용=0
  subStat9Level: number; // 미사용=0
  ssubStat9Level: number; // 미사용=0
  finalDmg: number;
  resetCoolDown: number;
  tms_fd: number; // 미사용=0
  /** 스캐폴딩: userStat.stat.weaponAtk 복사. */
  weaponAtk: number;
  masteryCore1: number; // 미사용=0
  masteryCore2: number; // 미사용=0
  masteryCore3: number; // 미사용=0
  masteryCore4: number; // 미사용=0
  skillCore1: number; // 미사용=0
  skillCore2: number; // 미사용=0
  reinCore1: number; // 미사용=0
  reinCore2: number; // 미사용=0
  reinCore3: number; // 미사용=0
  reinCore4: number; // 미사용=0
  generalCore2: number; // 미사용=0
  generalCore3: number; // 미사용=0
  erda: number;
  solJanus: number;
  /** 스캐폴딩: userStat.doping 복사. */
  dopingSimul: Doping;
  /** 스캐폴딩: userStat.linkSkill 복사. */
  linkSimul: LinkSkill;
  /** 스캐폴딩: userStat.special.restraintRing 복사. */
  restraintRing: number;
  weaponRing: number;
  ringofSum: number;
  riskTaker: number;
  contiRing: number;
  destiny2ndSkill: boolean;
}

// ── 최상위 페이로드 ──────────────────────────────────────────────────

/** POST /api/calc/dmg-simulator 요청 바디(TS-native 숫자형). */
export interface DmgSimulatorPayload {
  userStat: ScouterUserStat;
  simulator: DmgSimulator;
}
