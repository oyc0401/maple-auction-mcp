// 링크 스킬 → UserStat. 링크는 캐릭터 무관 동일 효과 → 전역 DB(스킬명 → 기여).
// 조건부("약점 파악 시"·"상태 이상 시"·"이동 시 스택"·"N초 버프")는 넥슨 resting(final_stat)에 미포함 —
// 티엘 실측: 무조건형(와일드 레이지)만 포함하면 데미지 잔차 0. (2026-07-11)
// 방침(유저): 실전(D 계산)에서는 조건부도 상시로 보고 다 반영. 스택형은 최대 중첩(mult), 발동 기본치는 base.
// → cond=true 항목은 includeConditional=true(전투 모드)일 때만 누적. resting 재구성은 false.
import type { UserStat } from './statSheet.js';
import { apply } from './parse.js';

function pick(effect: string, name: string): { val: number; pct: boolean } | null {
  const re = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\+?\\s*(-?\\d+(?:\\.\\d+)?)\\s*(%?)');
  const m = effect.match(re);
  return m ? { val: Number(m[1]), pct: m[2] === '%' } : null;
}

interface Pick { find: string; as?: string; mult?: number; base?: number; cond?: boolean }
// 스킬명 → 뽑을 항목들. find=effect상 검색어, as=apply 표준명, mult=최대중첩배수, base=발동 기본치, cond=조건부(전투 전용).
const LINK: Record<string, Pick[]> = {
  '소울 컨트랙트': [{ find: '데미지', as: '데미지', cond: true }],               // 엔버(10초 버프 — 실전 상시)
  '판단': [{ find: '크리티컬 데미지' }],                                        // 키네시스 (무조건)
  '인텐시브 인썰트': [{ find: '상태 이상에 걸린 몬스터 공격 시 데미지' }], // 카데나 — 넥슨 "상태이상 추가 데미지" 필드행(statusDmg), resting 포함
  '데몬스 퓨리': [{ find: '보스 몬스터 공격 시 데미지', as: '보스 몬스터 데미지' }], // 보공 스탯 자체 → 무조건
  '와일드 레이지': [{ find: '데미지', as: '데미지' }],                           // 무조건 (resting 포함 실측 확인)
  '무아': [{ find: '중첩당 데미지', as: '데미지', mult: 5, base: 1, cond: true }], // 발동1 + 5중첩×중첩치
  '하이브리드 로직': [{ find: '모든 능력치', as: '올스탯' }],                    // 제논 링크 → 올스탯% (무조건)
  '프라이어 프리퍼레이션': [{ find: '데미지', as: '데미지', cond: true }],        // 카인 (발동 버프)
  '전투의 흐름': [{ find: '중첩당 데미지', as: '데미지', mult: 4, cond: true }],  // 일리움 4중첩 (이동 스택)
  '노블레스': [{ find: '보스 몬스터 공격 시 데미지', as: '보스 몬스터 데미지' }, { find: '파티원 1명 당 데미지', as: '데미지', mult: 4, cond: true }], // 아델
  '자신감': [{ find: '방어율 무시', as: '방어율 무시' }, { find: 'HP가 100%인 몬스터 공격 시 데미지', as: '데미지', cond: true }], // 호영
  '퍼미에이트': [{ find: '방어율 무시', as: '방어율 무시' }],                    // 루미너스 (무조건)
  '데들리 인스팅트': [{ find: '크리티컬 확률' }],                                // 팬텀 (무조건)
  '임피리컬 널리지': [{ find: '데미지', as: '데미지', mult: 3, cond: true }, { find: '방어율 무시', mult: 3, cond: true }], // 약점 파악 3중첩
  '시프 커닝': [{ find: '데미지', as: '데미지', cond: true }],                   // 상태 이상 적용 시 버프
  // 파이렛 블레스: 효과 "힘 30, 민첩 30, 지력 30, 운 30, 최대 HP 525 …" — 4스탯 개별 파싱(해적 직업군 추가 보너스로 스탯별 값이 갈릴 수 있어 올스탯으로 뭉개지 않는다).
  // ⚠️ mult 3은 꽈숩노 잔차 실측(INT/LUK에 90 필요 = 30×3)으로 맞춘 값 — 스택 수가 API에 없고
  //    챌린저스 상시버프 올스탯과 축퇴(어느 쪽이 90인지 구분 불가)라 출처 미확정. 인게임 버프창 실측 대기.
  '파이렛 블레스': [{ find: '힘', mult: 3 }, { find: '민첩', mult: 3 }, { find: '지력', mult: 3 }, { find: '운', mult: 3 }],
  '시그너스 블레스': [{ find: '공격력과 마력' }],                               // 공/마 (무조건)
};

export function collectLinkSkills(us: UserStat, link: any, includeConditional = false): void {
  // 전수받은 링크 + 본인 링크(character_owned_link_skill — 단일 객체) 모두 처리.
  // 본인 링크는 character_link_skill 목록에 안 나오지만 본인에게 적용된다(오유찬 상태이상 추가 데미지 실측).
  const transferred = link?.character_link_skill ?? link?.character_link_skill_info ?? [];
  const owned = link?.character_owned_link_skill;
  const skills = [...transferred, ...(owned ? [owned].flat() : [])];
  for (const s of skills) {
    // 본인 링크는 "파이렛 블레스(캡틴)"처럼 직업 접미사가 붙는다 → 접미사 떼고도 매칭.
    const rule = LINK[s.skill_name] ?? LINK[String(s.skill_name ?? '').replace(/\([^)]*\)\s*$/, '').trim()];
    if (!rule) continue;
    const eff = String(s.skill_effect ?? '');
    for (const p of rule) {
      if (p.cond && !includeConditional) continue;
      const r = pick(eff, p.find);
      if (r) apply(us, p.as ?? p.find, r.val * (p.mult ?? 1) + (p.base ?? 0), r.pct);
    }
  }
}
