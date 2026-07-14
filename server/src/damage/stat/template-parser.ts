import { MapleStat, type StatBlock } from '../stat-interface.js';

export type MapleTemplate =
  | string
  | {
      template: string;
      mul: number;
    };

export interface NormalizedMapleTemplate {
  template: string;
  mul: number;
}

export function normalizeMapleTemplate(
  rule: MapleTemplate
): NormalizedMapleTemplate {
  return typeof rule === 'string' ? { template: rule, mul: 1 } : rule;
}

export interface MapleTemplateParseResult {
  block: StatBlock;
  unmatchedTemplates: string[];
}

const PLACEHOLDER_STATS: Record<string, readonly MapleStat[]> = {
  STR: [MapleStat.STR],
  DEX: [MapleStat.DEX],
  INT: [MapleStat.INT],
  LUK: [MapleStat.LUK],
  // 미적용 = 주스탯%·올스탯% 미적용 버킷(심볼·하이퍼 주스탯 등). 템플릿 작성자가 소스별로 지정.
  STR미적용: [MapleStat.STR미적용],
  DEX미적용: [MapleStat.DEX미적용],
  INT미적용: [MapleStat.INT미적용],
  LUK미적용: [MapleStat.LUK미적용],
  // 유니온 특수 배치 "STR, DEX, LUK N 증가"(한 값 → 3스탯) 전용.
  'STR/DEX/LUK미적용': [
    MapleStat.STR미적용,
    MapleStat.DEX미적용,
    MapleStat.LUK미적용,
  ],
  올스탯: [MapleStat.올스탯],
  올스탯미적용: [MapleStat.올스탯미적용], // 유니온 "ALLSTAT N"(주스탯% 미적용 올스탯)
  STR퍼: [MapleStat.STR퍼],
  DEX퍼: [MapleStat.DEX퍼],
  INT퍼: [MapleStat.INT퍼],
  LUK퍼: [MapleStat.LUK퍼],
  올스탯퍼: [MapleStat.올스탯퍼],
  공격력: [MapleStat.공격력],
  마력: [MapleStat.마력],
  '공/마': [MapleStat.공격력, MapleStat.마력],
  공격력퍼: [MapleStat.공격력퍼],
  마력퍼: [MapleStat.마력퍼],
  '공/마퍼': [MapleStat.공격력퍼, MapleStat.마력퍼],
  데미지: [MapleStat.데미지],
  보공: [MapleStat.보공],
  추가뎀: [MapleStat.추가뎀],
  방무: [MapleStat.방무],
  최종뎀: [MapleStat.최종뎀],
  크확: [MapleStat.크확],
  크뎀: [MapleStat.크뎀],
  HP: [MapleStat.HP],
  HP미적용: [MapleStat.HP미적용], // 유니온 "최대 HP N"(주스탯% 미적용 깡 HP)
  HP퍼: [MapleStat.HP퍼],
};

const PLACEHOLDER = /\$\{([^}]+)\}/g;
const NUMBER_CAPTURE = '([+-]?\\d[\\d,]*(?:\\.\\d+)?)';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function literalPattern(value: string): string {
  return value
    .split(/(\s+)/)
    .map((part) => (/^\s+$/.test(part) ? '\\s+' : escapeRegex(part)))
    .join('');
}

function compileTemplate(template: string): {
  regex: RegExp;
  targets: readonly MapleStat[][];
} {
  const targets: MapleStat[][] = [];
  let source = '';
  let cursor = 0;

  for (const match of template.matchAll(PLACEHOLDER)) {
    const index = match.index ?? 0;
    const placeholder = match[1];
    const stats = PLACEHOLDER_STATS[placeholder];
    if (!stats)
      throw new Error(`알 수 없는 MapleTemplate placeholder: ${placeholder}`);

    source += literalPattern(template.slice(cursor, index));
    source += NUMBER_CAPTURE;
    targets.push([...stats]);
    cursor = index + match[0].length;
  }

  if (targets.length === 0)
    throw new Error(`placeholder가 없는 MapleTemplate: ${template}`);
  source += literalPattern(template.slice(cursor));
  return { regex: new RegExp(source), targets };
}

function applyStat(block: StatBlock, stat: MapleStat, value: number): void {
  if (stat === MapleStat.방무) {
    (block.방무 ??= []).push(value);
    return;
  }
  if (stat === MapleStat.최종뎀) {
    (block.최종뎀 ??= []).push(value);
    return;
  }

  const values = block as Record<string, number | number[] | undefined>;
  const current = values[stat];
  if (Array.isArray(current))
    throw new Error(`가산 스탯에 배열 값이 들어있음: ${stat}`);
  values[stat] = (current ?? 0) + value;
}

export function parseMapleTemplates(
  effect: string | null | undefined,
  rules: readonly MapleTemplate[]
): MapleTemplateParseResult {
  const block: StatBlock = {};
  const unmatchedTemplates: string[] = [];
  const normalizedEffect = String(effect ?? '').replace(/\r\n?/g, '\n');

  for (const rule of rules) {
    const { template, mul } = normalizeMapleTemplate(rule);
    if (!Number.isInteger(mul) || mul < 1) {
      throw new Error(`MapleTemplate mul은 1 이상의 정수여야 함: ${mul}`);
    }

    const { regex, targets } = compileTemplate(template);
    const match = regex.exec(normalizedEffect);
    if (!match) {
      unmatchedTemplates.push(template);
      continue;
    }

    for (let index = 0; index < targets.length; index += 1) {
      const value = Number(match[index + 1].replaceAll(',', ''));
      for (let count = 0; count < mul; count += 1) {
        for (const stat of targets[index]) applyStat(block, stat, value);
      }
    }
  }

  return { block, unmatchedTemplates };
}

// 라인당 "첫 매칭 템플릿만" 채택. 부분문자열 충돌(바 '데미지' ⊂ '보스 몬스터 공격 시 데미지',
// '일반 몬스터 공격 시 데미지') 방지 — 라인이 그 스탯명으로 시작할 때만 매칭(레거시 풀라인 앵커 계승).
// 구체적인 템플릿을 앞에 둘 것. parseMapleTemplates(all-fire)와 달리 하나만 문다.
export function parseFirstTemplate(
  line: string,
  templates: readonly MapleTemplate[]
): StatBlock {
  const head = line.replace(/\r\n?/g, '\n').trimStart();
  for (const rule of templates) {
    const { template } = normalizeMapleTemplate(rule);
    const lead = template.slice(0, template.indexOf('${')); // 첫 placeholder 앞 리터럴 = 스탯명
    if (lead && !head.startsWith(lead)) continue; // 라인이 스탯명으로 시작해야 함
    const { block } = parseMapleTemplates(line, [rule]);
    if (Object.keys(block).length > 0) return block;
  }
  return {};
}

// 콤마 독립절("공격력 N, 마력 N")은 분해, 공유값("STR, DEX, LUK N")은 통째로 — 레거시 accumIncrease 규칙.
function splitClauses(line: string): string[] {
  const segs = line.split(',').map((s) => s.trim());
  return segs.length > 1 && segs.every((s) => /\d/.test(s)) ? segs : [line];
}

// 값이 이미 박힌 효과 문자열 여러 줄(유니온·어빌리티·아티팩트) → StatBlock. 반복 라인은 누산.
export function parseEffectLines(
  lines: readonly string[],
  templates: readonly MapleTemplate[]
): StatBlock {
  const result: StatBlock = {};
  for (const line of lines) {
    for (const seg of splitClauses(line)) {
      mergeStatBlock(result, parseFirstTemplate(seg, templates));
    }
  }
  return result;
}

// 여러 줄을 각각 파싱해 누산할 때 쓴다(반복 등장하는 유니온·어빌리티 라인). 배열(방무·최종뎀)은 이어붙이고 스칼라는 더한다.
export function mergeStatBlock(target: StatBlock, src: StatBlock): void {
  for (const [key, value] of Object.entries(src)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      const arr = (target as Record<string, number[]>)[key] ?? [];
      arr.push(...value);
      (target as Record<string, number[]>)[key] = arr;
    } else {
      const t = target as Record<string, number>;
      t[key] = (t[key] ?? 0) + value;
    }
  }
}
