// 환산 모듈 공개 API.
export { fetchCharacterSpec, nexonApiKey, type CharacterSpec } from './nexon.js';
export {
  contributionFromRawItem,
  contributionFromEquip,
  hwansanDiff,
  damageMultiplier,
  BOSS_DEFENSE,
  type Contribution,
  type CharState,
} from './calc.js';
export { resolveStatModel, isMagicModel, type MainStat, type StatModel } from './jobs.js';
