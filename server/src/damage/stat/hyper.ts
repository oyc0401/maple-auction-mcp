import type { HyperStatLine, HyperStatRes } from '../../nexon/index.js';
import type { StatBlock } from '../stat-interface.js';
import { HYPER } from './hyper-db.js';
import { parseMapleTemplates } from './template-parser.js';

// 활성 프리셋만 반영. use_preset_no("1"|"2"|"3")가 가리키는 배열을 고른다.
function selectPreset(hyper: HyperStatRes): HyperStatLine[] {
  switch (hyper.use_preset_no) {
    case '2': return hyper.hyper_stat_preset_2 ?? [];
    case '3': return hyper.hyper_stat_preset_3 ?? [];
    default: return hyper.hyper_stat_preset_1 ?? [];
  }
}

// 하이퍼스탯 → StatBlock. stat_type로 룰을 찾고 stat_increase를 파싱해 한 블록에 누산한다.
export function getHyper(hyper: HyperStatRes): StatBlock {
  const result: StatBlock = {};

  for (const line of selectPreset(hyper)) {
    const templates = HYPER[line.stat_type];
    if (!templates) continue;

    const { block } = parseMapleTemplates(line.stat_increase, templates);
    for (const [key, value] of Object.entries(block)) {
      if (Array.isArray(value)) {
        const arr = result[key as '방무'] ?? [];
        arr.push(...value);
        result[key as '방무'] = arr;
      } else if (value) {
        result[key as 'STR'] = (result[key as 'STR'] ?? 0) + value;
      }
    }
  }

  return result;
}
