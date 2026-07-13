import { MapleStat, type StatBlock } from '../stat-interface.js';

export type MapleTemplate = string | {
  template: string;
  mul: number;
};

export interface NormalizedMapleTemplate {
  template: string;
  mul: number;
}

export function normalizeMapleTemplate(rule: MapleTemplate): NormalizedMapleTemplate {
  return typeof rule === 'string'
    ? { template: rule, mul: 1 }
    : rule;
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
  올스탯: [MapleStat.올스탯],
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

function compileTemplate(template: string): { regex: RegExp; targets: readonly MapleStat[][] } {
  const targets: MapleStat[][] = [];
  let source = '';
  let cursor = 0;

  for (const match of template.matchAll(PLACEHOLDER)) {
    const index = match.index ?? 0;
    const placeholder = match[1];
    const stats = PLACEHOLDER_STATS[placeholder];
    if (!stats) throw new Error(`알 수 없는 MapleTemplate placeholder: ${placeholder}`);

    source += literalPattern(template.slice(cursor, index));
    source += NUMBER_CAPTURE;
    targets.push([...stats]);
    cursor = index + match[0].length;
  }

  if (targets.length === 0) throw new Error(`placeholder가 없는 MapleTemplate: ${template}`);
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
  if (Array.isArray(current)) throw new Error(`가산 스탯에 배열 값이 들어있음: ${stat}`);
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
