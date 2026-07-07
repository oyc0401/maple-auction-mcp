// 환산 모듈 공개 API.
export { fetchCharacterSpec, nexonApiKey, type CharacterSpec } from './nexon.js';
export {
  contributionFromAuction,
  hwansanDiff,
  damageMultiplier,
  BOSS_DEFENSE,
  type Contribution,
  type SpecTotals,
} from './calc.js';
export { resolveStatModel, type MainStat, type StatModel } from './jobs.js';
