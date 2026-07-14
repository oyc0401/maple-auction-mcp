import type { StatBlock } from '../stat-interface.js';

const NUMBER = '[+-]?\\d+(?:\\.\\d+)?';

function addScalar(block: StatBlock, key: string, value: number): void {
  const values = block as Record<string, number>;
  values[key] = (values[key] ?? 0) + value;
}

function addStack(block: StatBlock, key: '방무' | '최종뎀', value: number): void {
  block[key] = [...(block[key] ?? []), value];
}

export function parseEffectLines(
  lines: readonly string[]
): StatBlock {
  const block: StatBlock = {};

  for (const source of lines) {
    let line = source.trim();

    line = line.replace(
      new RegExp(`STR\\s*,\\s*DEX\\s*,\\s*LUK\\s+(${NUMBER})\\s*증가`),
      (_, raw: string) => {
        const value = Number(raw);
        addScalar(block, 'STR', value);
        addScalar(block, 'DEX', value);
        addScalar(block, 'LUK', value);
        return '';
      }
    );

    line = line.replace(
      new RegExp(`공격력\\s*[/／]\\s*마력\\s+(${NUMBER})\\s*증가`),
      (_, raw: string) => {
        const value = Number(raw);
        addScalar(block, '공격력', value);
        addScalar(block, '마력', value);
        return '';
      }
    );

    for (const clause of line.split(',').map((value) => value.trim())) {
      if (!clause) continue;

      let match = new RegExp(
        `^보스 몬스터 공격 시 데미지\\s+(${NUMBER})%\\s*증가$`
      ).exec(clause);
      if (match) {
        addScalar(block, '보공', Number(match[1]));
        continue;
      }

      match = new RegExp(
        `^상태 이상에 걸린 대상 공격 시 데미지\\s+(${NUMBER})%\\s*증가$`
      ).exec(clause);
      if (match) {
        addScalar(block, '추가뎀', Number(match[1]));
        continue;
      }

      match = new RegExp(
        `^(?:몬스터 )?방어율 무시\\s+(${NUMBER})%\\s*증가$`
      ).exec(clause);
      if (match) {
        addStack(block, '방무', Number(match[1]));
        continue;
      }

      match = new RegExp(`^크리티컬 데미지\\s+(${NUMBER})%\\s*증가$`).exec(
        clause
      );
      if (match) {
        addScalar(block, '크뎀', Number(match[1]));
        continue;
      }

      match = new RegExp(`^크리티컬 확률\\s+(${NUMBER})%\\s*증가$`).exec(
        clause
      );
      if (match) {
        addScalar(block, '크확', Number(match[1]));
        continue;
      }

      match = new RegExp(`^데미지\\s+(${NUMBER})%\\s*증가$`).exec(clause);
      if (match) {
        addScalar(block, '데미지', Number(match[1]));
        continue;
      }

      match = new RegExp(`^최대 HP\\s+(${NUMBER})(%)?\\s*증가$`).exec(clause);
      if (match) {
        addScalar(block, match[2] ? 'HP퍼' : 'HP', Number(match[1]));
        continue;
      }

      match = new RegExp(
        `^(STR|DEX|INT|LUK|올스탯|ALLSTAT|공격력|마력)\\s+(${NUMBER})\\s*(?:증가)?$`
      ).exec(clause);
      if (match) {
        const key = match[1] === 'ALLSTAT' ? '올스탯' : match[1];
        addScalar(block, key, Number(match[2]));
      }
    }
  }

  return block;
}
