// 리팩토링용 스켈레톤 — CharacterStats 조립이 지향하는 모양(파이프라인 미연결, 내부 미구현).
// character.ts(buildCharacterStats)의 인라인 조립을 파트별 get*로 하나씩 옮겨 이 모양으로 수렴시킨다.
// 지금은 스킬 파트(getSkill)만 실제 이관됨. 나머지 get*는 시그니처만 — 바디는 아직 안 채운다.
import type { CharacterStats, StatBlock, GearStats } from './stat-interface.js';
import type { RawBundle } from '../damage/nexon.js';
import { getSkill } from './stat/skill.js';

export function getCharacterStats(bundle: RawBundle): CharacterStats {
  const job: string = bundle.stat?.character_class ?? '';
  const skill = getSkill(job, bundle);

  // prune: 빈 블록(isEmptyBlock)인 파트는 키 자체를 드롭 → optional 키는 부재로 남는다.
  return {
    기본: { 크확: 5, 크뎀: 35 },
    AP: getAP(bundle),

    장비:      getGear(bundle),
    세트효과:   getSet(bundle),
    심볼:      getSymbol(bundle),
    하이퍼스탯:  getHyper(bundle),
    어빌리티:   getAbility(bundle),
    유니온:    getUnion(bundle),
    아티팩트:   getArtifact(bundle),
    챔피언:    getChampion(bundle),
    성향:      getPropensity(bundle),
    헥사스탯:   getHexaStat(bundle),
    챌린저스:   getChallenger(bundle),
    버닝:      getBurning(bundle),
    길드스킬:   getGuild(bundle),
    캐시장비:   getCash(bundle),
    링크스킬:   getLink(bundle),
    불릿:      getBullet(bundle),

    // 스킬 파트만 이미 이관됨 (skill.ts / getSkill)
    메이플용사:     skill.메이플용사,
    크리티컬리인포스: skill.크리티컬리인포스,
    스킬_0차:  skill.스킬_0차,
    스킬_1차:  skill.스킬_1차,
    스킬_2차:  skill.스킬_2차,
    스킬_3차:  skill.스킬_3차,
    스킬_4차:  skill.스킬_4차,
    스킬_하이퍼: skill.스킬_하이퍼,
    스킬_5차:  skill.스킬_5차,
  }
}

// ── 이관 대상 get* (시그니처만 — character.ts의 blockOf((u)=>collect*(...)) 한 줄씩을 흡수한다) ──

// AP 배분 STR/DEX/INT/LUK/HP를 final_stat에서 직독. HP는 데벤 대응(넥슨 값이 0이면 레벨 역산 분기).
function getAP(bundle: RawBundle): StatBlock { throw new Error('TODO: getAP'); }

function getGear(bundle: RawBundle): GearStats { throw new Error('TODO: getGear'); }
function getSet(bundle: RawBundle): Record<string, StatBlock> { throw new Error('TODO: getSet'); }
function getSymbol(bundle: RawBundle): StatBlock { throw new Error('TODO: getSymbol'); }
function getHyper(bundle: RawBundle): StatBlock { throw new Error('TODO: getHyper'); }
function getAbility(bundle: RawBundle): StatBlock { throw new Error('TODO: getAbility'); }
function getUnion(bundle: RawBundle): StatBlock { throw new Error('TODO: getUnion'); }
function getArtifact(bundle: RawBundle): StatBlock { throw new Error('TODO: getArtifact'); }
function getChampion(bundle: RawBundle): StatBlock { throw new Error('TODO: getChampion'); }
function getPropensity(bundle: RawBundle): StatBlock { throw new Error('TODO: getPropensity'); }

// 넥슨 API가 값 없이 이름+레벨(1~10)만 줌 → 내부에서 레벨→값 테이블로 역산해 block 반환.
function getHexaStat(bundle: RawBundle): StatBlock { throw new Error('TODO: getHexaStat'); }

function getChallenger(bundle: RawBundle): StatBlock { throw new Error('TODO: getChallenger'); }
function getBurning(bundle: RawBundle): StatBlock { throw new Error('TODO: getBurning'); }
function getGuild(bundle: RawBundle): StatBlock { throw new Error('TODO: getGuild'); }
function getCash(bundle: RawBundle): StatBlock { throw new Error('TODO: getCash'); }
function getLink(bundle: RawBundle): Record<string, StatBlock> { throw new Error('TODO: getLink'); }
function getBullet(bundle: RawBundle): StatBlock { throw new Error('TODO: getBullet'); }
