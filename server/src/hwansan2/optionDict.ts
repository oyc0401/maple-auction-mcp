// 옵션 문구 사전 — 문구(key)는 고정 유한 집합, 수치(value)만 아이템마다 다르다.
// 등록된 정확한 형태("이름 +값[%]")만 인정, 그 외는 unknown으로 노출(조용히 버리지 않음).
export type OptionKey =
  | 'STR' | 'DEX' | 'INT' | 'LUK' | 'allStat' | 'hp'
  | 'atk' | 'matk' | 'dmg' | 'boss' | 'ied' | 'critDmg' | 'finalDmg' | 'coolSec' | 'critRate';

const NAME_TO_KEY: Record<string, OptionKey> = {
  STR: 'STR', DEX: 'DEX', INT: 'INT', LUK: 'LUK',
  올스탯: 'allStat', '최대 HP': 'hp',
  공격력: 'atk', 마력: 'matk',
  데미지: 'dmg', '보스 몬스터 데미지': 'boss', '보스 데미지': 'boss',
  '몬스터 방어율 무시': 'ied', '크리티컬 데미지': 'critDmg', '최종 데미지': 'finalDmg',
  '크리티컬 확률': 'critRate',
};

// "이름 +13%" / "이름, 이름 +36" (실측: 콜론 없음) / "스킬 재사용 대기시간 -2초"
const OPT_RE = /^(.+?)\s*\+\s*(\d+(?:\.\d+)?)\s*(%?)$/;
const COOL_RE = /^스킬 재사용 대기시간\s*-\s*(\d+(?:\.\d+)?)\s*초$/;

export function parseOptionLine(
  line: string | null | undefined
): { key: OptionKey; val: number; pct: boolean } | { unknown: string } | null {
  if (!line || !line.trim()) return null;
  const t = line.trim();
  const cool = t.match(COOL_RE);
  if (cool) return { key: 'coolSec', val: Number(cool[1]), pct: false };
  const m = t.match(OPT_RE);
  if (!m) return { unknown: t };
  const key = NAME_TO_KEY[m[1].trim()];
  if (!key) return { unknown: t };
  return { key, val: Number(m[2]), pct: m[3] === '%' };
}
