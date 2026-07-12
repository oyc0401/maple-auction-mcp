import type { UserStat } from './statSheet.js';
import { apply } from './parse.js';

function pick(effect: string, name: string): { val: number; pct: boolean } | null {
  const re = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\+?\\s*(-?\\d+(?:\\.\\d+)?)\\s*(%?)');
  const m = effect.match(re);
  return m ? { val: Number(m[1]), pct: m[2] === '%' } : null;
}

interface Pick { find: string; as?: string; mult?: number; base?: number }
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
  '파이렛 블레스': [{ find: '힘' }, { find: '민첩' }, { find: '지력' }, { find: '운' }],
  '시그너스 블레스': [{ find: '공격력과 마력' }],
};

export function collectLinkSkills(us: UserStat, link: any): void {
  const transferred = link?.character_link_skill ?? link?.character_link_skill_info ?? [];
  const owned = link?.character_owned_link_skill;
  const skills = [...transferred, ...(owned ? [owned].flat() : [])];
  for (const s of skills) {
    const rule = LINK[s.skill_name] ?? LINK[String(s.skill_name ?? '').replace(/\([^)]*\)\s*$/, '').trim()];
    if (!rule) continue;
    const eff = String(s.skill_effect ?? '');
    for (const p of rule) {
      const r = pick(eff, p.find);
      if (r) apply(us, p.as ?? p.find, r.val * (p.mult ?? 1) + (p.base ?? 0), r.pct);
    }
  }
}
