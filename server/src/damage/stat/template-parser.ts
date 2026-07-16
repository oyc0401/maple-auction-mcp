import { MapleStat, type StatBlock } from '../stat-interface.js';

export type MapleTemplate =
  | string
  | {
      template: string;
      mul: number;
    };

interface NormalizedMapleTemplate {
  template: string;
  mul: number;
}

function normalizeMapleTemplate(
  rule: MapleTemplate
): NormalizedMapleTemplate {
  return typeof rule === 'string' ? { template: rule, mul: 1 } : rule;
}

interface MapleTemplateParseResult {
  block: StatBlock;
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
  const normalizedEffect = String(effect ?? '').replace(/\r\n?/g, '\n');

  for (const rule of rules) {
    const { template, mul } = normalizeMapleTemplate(rule);

    const { regex, targets } = compileTemplate(template);
    const match = regex.exec(normalizedEffect);
    if (!match) continue;

    for (let index = 0; index < targets.length; index += 1) {
      const value = Number(match[index + 1].replaceAll(',', ''));
      const whole = Math.floor(mul);
      const fraction = mul - whole;

      for (let count = 0; count < whole; count += 1) {
        for (const stat of targets[index]) applyStat(block, stat, value);
      }
      if (fraction > 0) {
        for (const stat of targets[index])
          applyStat(block, stat, value * fraction);
      }
    }
  }

  return { block };
}
