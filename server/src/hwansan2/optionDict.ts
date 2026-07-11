// 옵션 문구 사전 — 문구(key)는 고정 유한 집합, 수치(value)만 아이템마다 다르다.
// 등록된 정확한 형태("이름 +값[%]")만 인정, 그 외는 unknown으로 노출(조용히 버리지 않음).
export type OptionKey =
  | 'STR' | 'DEX' | 'INT' | 'LUK' | 'allStat' | 'hp'
  | 'atk' | 'matk' | 'dmg' | 'boss' | 'ied' | 'critDmg' | 'finalDmg' | 'coolSec' | 'critRate'
  | 'perLevSTR' | 'perLevDEX' | 'perLevINT' | 'perLevLUK';

const NAME_TO_KEY: Record<string, OptionKey> = {
  STR: 'STR', DEX: 'DEX', INT: 'INT', LUK: 'LUK',
  올스탯: 'allStat', '최대 HP': 'hp',
  공격력: 'atk', 마력: 'matk',
  데미지: 'dmg', '보스 몬스터 데미지': 'boss', '보스 데미지': 'boss',
  // 소울 문구 변형(실측: 위대한 소울 툴팁): "보스 몬스터 공격 시 데미지 +7%"
  '보스 몬스터 공격 시 데미지': 'boss',
  '몬스터 방어율 무시': 'ied', '크리티컬 데미지': 'critDmg', '최종 데미지': 'finalDmg',
  '크리티컬 확률': 'critRate',
};

// 데미지 계산과 무관해 조용히 무시할 옵션 (unknown 소음 방지 — 등록된 이름만, 그 외는 여전히 unknown 노출)
const IGNORE_NAMES = new Set([
  '방어력', '최대 MP', '이동속도', '점프력', '착용 레벨 감소',
  '모든 속성 내성', '상태 이상 내성', 'HP 회복', 'MP 회복',
]);

// "이름 +13%" / "이름, 이름 +36" (실측: 콜론 없음) / "스킬 재사용 대기시간 -2초"
const OPT_RE = /^(.+?)\s*\+\s*(\d+(?:\.\d+)?)\s*(%?)$/;
const COOL_RE = /^스킬 재사용 대기시간\s*-\s*(\d+(?:\.\d+)?)\s*초$/;
// 에디셔널 전용: "캐릭터 기준 9레벨 당 LUK +2" — 캐릭터 레벨을 알아야 깡스탯으로 환산된다(축 적용은 axes에서)
const PER_LEV_RE = /^캐릭터 기준 9레벨 당 (STR|DEX|INT|LUK)\s*\+\s*(\d+)$/;

export function parseOptionLine(
  line: string | null | undefined
): { key: OptionKey; val: number; pct: boolean } | { unknown: string } | null {
  if (!line || !line.trim()) return null;
  const t = line.trim();
  const cool = t.match(COOL_RE);
  if (cool) return { key: 'coolSec', val: Number(cool[1]), pct: false };
  const perLev = t.match(PER_LEV_RE);
  if (perLev) return { key: `perLev${perLev[1]}` as OptionKey, val: Number(perLev[2]), pct: false };
  const m = t.match(OPT_RE);
  if (!m) return { unknown: t };
  const name = m[1].trim();
  if (IGNORE_NAMES.has(name)) return null; // 계산 무관 옵션은 조용히 무시
  const key = NAME_TO_KEY[name];
  if (!key) return { unknown: t };
  return { key, val: Number(m[2]), pct: m[3] === '%' };
}
