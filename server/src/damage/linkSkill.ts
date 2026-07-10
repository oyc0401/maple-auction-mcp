// 링크 스킬 → UserStat. 링크는 캐릭터 무관 동일 효과 → 전역 DB(스킬명 → 기여).
// 방침(유저): 조건부("약점 파악 시"·"상태 이상 시"·"이동 시 스택")도 실전 상시로 보고 다 반영,
// 스택형은 최대 중첩 기준(mult), 발동 기본치는 base. 값은 skill_effect(현재 레벨 수치)에서 파싱.
import type { UserStat } from './statSheet.js';
import { apply } from './parse.js';

function pick(effect: string, name: string): { val: number; pct: boolean } | null {
  const re = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\+?\\s*(-?\\d+(?:\\.\\d+)?)\\s*(%?)');
  const m = effect.match(re);
  return m ? { val: Number(m[1]), pct: m[2] === '%' } : null;
}

interface Pick { find: string; as?: string; mult?: number; base?: number }
// 스킬명 → 뽑을 항목들. find=effect상 검색어, as=apply 표준명, mult=최대중첩배수, base=발동 기본치.
const LINK: Record<string, Pick[]> = {
  '소울 컨트랙트': [{ find: '데미지', as: '데미지' }],                         // 엔버(실전 상시)
  '판단': [{ find: '크리티컬 데미지' }],                                        // 키네시스
  '인텐시브 인썰트': [{ find: '상태 이상에 걸린 몬스터 공격 시 데미지', as: '데미지' }], // 카데나(보스=상태이상 적용분만)
  '데몬스 퓨리': [{ find: '보스 몬스터 공격 시 데미지', as: '보스 몬스터 데미지' }],
  '와일드 레이지': [{ find: '데미지', as: '데미지' }],
  '무아': [{ find: '중첩당 데미지', as: '데미지', mult: 5, base: 1 }],           // 발동1 + 5중첩×중첩치
  '하이브리드 로직': [{ find: '모든 능력치', as: '올스탯' }],                    // 제논 링크 → 올스탯%
  '프라이어 프리퍼레이션': [{ find: '데미지', as: '데미지' }],                   // 카인
  '전투의 흐름': [{ find: '중첩당 데미지', as: '데미지', mult: 4 }],             // 일리움 4중첩
  '노블레스': [{ find: '보스 몬스터 공격 시 데미지', as: '보스 몬스터 데미지' }, { find: '파티원 1명 당 데미지', as: '데미지', mult: 4 }], // 아델
  '자신감': [{ find: '방어율 무시', as: '방어율 무시' }, { find: 'HP가 100%인 몬스터 공격 시 데미지', as: '데미지' }], // 호영
  '퍼미에이트': [{ find: '방어율 무시', as: '방어율 무시' }],                    // 루미너스
  '데들리 인스팅트': [{ find: '크리티컬 확률' }],                                // 팬텀
  '임피리컬 널리지': [{ find: '데미지', as: '데미지', mult: 3 }, { find: '방어율 무시', mult: 3 }], // 3중첩
  '시프 커닝': [{ find: '데미지', as: '데미지' }],
  '파이렛 블레스': [{ find: '올스텟', as: '올스탯' }, { find: '올스탯', as: '올스탯' }], // 해적3 → 올스탯 flat
  '시그너스 블레스': [{ find: '공격력과 마력' }],                               // 공/마
};

export function collectLinkSkills(us: UserStat, link: any): void {
  const skills = link?.character_link_skill ?? link?.character_link_skill_info ?? [];
  for (const s of skills) {
    const rule = LINK[s.skill_name];
    if (!rule) continue;
    const eff = String(s.skill_effect ?? '');
    for (const p of rule) {
      const r = pick(eff, p.find);
      if (r) apply(us, p.as ?? p.find, r.val * (p.mult ?? 1) + (p.base ?? 0), r.pct);
    }
  }
}
