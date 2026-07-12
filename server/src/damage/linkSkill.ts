// 링크 스킬 → UserStat. 링크는 캐릭터 무관 동일 효과라 전역 DB(스킬명 → 기여)로 관리한다.
// 조건부·버프형 효과도 상시(풀가동·풀중첩)로 반영하며, 조건부 데미지는 추가뎀으로 분류한다.
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
  '소울 컨트랙트': [{ find: '데미지', as: '추가뎀' }],
  '판단': [{ find: '크리티컬 데미지' }],
  '인텐시브 인썰트': [
    { find: '상태 이상에 걸린 몬스터 공격 시 데미지', as: '추가뎀' },
    { find: '캐릭터보다 레벨이 낮은 몬스터 공격 시 데미지', as: '추가뎀' },
  ],
  '데몬스 퓨리': [{ find: '보스 몬스터 공격 시 데미지', as: '보스 몬스터 데미지' }],
  '와일드 레이지': [{ find: '데미지', as: '데미지' }],
  '무아': [{ find: '중첩당 데미지', as: '추가뎀', mult: 5, base: 1 }],
  '하이브리드 로직': [{ find: '모든 능력치', as: '올스탯' }],
  '프라이어 프리퍼레이션': [{ find: '데미지', as: '추가뎀' }],
  '전투의 흐름': [{ find: '중첩당 데미지', as: '추가뎀', mult: 4 }],
  '노블레스': [{ find: '보스 몬스터 공격 시 데미지', as: '보스 몬스터 데미지' }, { find: '파티원 1명 당 데미지', as: '추가뎀', mult: 4 }],
  '자신감': [{ find: '방어율 무시', as: '방어율 무시' }, { find: 'HP가 100%인 몬스터 공격 시 데미지', as: '추가뎀' }],
  '퍼미에이트': [{ find: '방어율 무시', as: '방어율 무시' }],
  '데들리 인스팅트': [{ find: '크리티컬 확률' }],
  '임피리컬 널리지': [{ find: '데미지', as: '추가뎀', mult: 3 }, { find: '방어율 무시', mult: 3 }],
  '시프 커닝': [{ find: '데미지', as: '추가뎀' }],
  // 파이렛 블레스: 해적 직업군 추가 보너스로 스탯별 값이 갈릴 수 있어 올스탯으로 뭉개지 않고 4스탯 개별 파싱.
  // ⚠️ mult 3은 최대 스택 기준 — 스택 수가 API에 없어 출처 미확정.
  '파이렛 블레스': [{ find: '힘', mult: 3 }, { find: '민첩', mult: 3 }, { find: '지력', mult: 3 }, { find: '운', mult: 3 }],
  '시그너스 블레스': [{ find: '공격력과 마력' }],
};

export function collectLinkSkills(us: UserStat, link: any): void {
  // 전수받은 링크 + 본인 링크(character_owned_link_skill — 단일 객체) 모두 처리.
  // 본인 링크는 character_link_skill 목록에 나오지 않지만 본인에게 적용된다.
  const transferred = link?.character_link_skill ?? link?.character_link_skill_info ?? [];
  const owned = link?.character_owned_link_skill;
  const skills = [...transferred, ...(owned ? [owned].flat() : [])];
  for (const s of skills) {
    // 본인 링크는 "파이렛 블레스(캡틴)"처럼 직업 접미사가 붙는다 → 접미사 떼고도 매칭.
    const rule = LINK[s.skill_name] ?? LINK[String(s.skill_name ?? '').replace(/\([^)]*\)\s*$/, '').trim()];
    if (!rule) continue;
    const eff = String(s.skill_effect ?? '');
    for (const p of rule) {
      const r = pick(eff, p.find);
      if (r) apply(us, p.as ?? p.find, r.val * (p.mult ?? 1) + (p.base ?? 0), r.pct);
    }
  }
}
