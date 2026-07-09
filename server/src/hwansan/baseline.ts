// 환산 "기준점"(현재 절대 환산값) 저장소.
// 사이트에서 확인한 캐릭터의 현재 환산값을 캐릭터명별로 저장해두면,
// 매물 교체 시 "기존 환산 → 변경 환산"을 계산할 수 있다 (통장 잔고 방식: 기준값 + Δ환산).
// 파일: server/data/hwansan-baseline.json  →  { "캐릭터명": 41485 }
// 절대 환산 자체를 계산하진 않으므로(직업 상수·헥사 등 미반영), 이 기준값은 사람이 넣는다.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
// dev(server/src/hwansan) / 빌드본(server/dist) 둘 다에서 server/data 를 가리키도록 후보 경로를 시도.
const CANDIDATES = [
  resolve(MODULE_DIR, '..', '..', 'data', 'hwansan-baseline.json'), // dev
  resolve(MODULE_DIR, '..', 'data', 'hwansan-baseline.json'), // 빌드본
];

function readAll(): Record<string, number> {
  for (const p of CANDIDATES) {
    try {
      return JSON.parse(readFileSync(p, 'utf8')) as Record<string, number>;
    } catch {
      /* 다음 후보 시도 */
    }
  }
  return {};
}

// 캐릭터의 기준 환산값. 없으면 null (이때는 Δ환산만 표시).
export function getBaseline(characterName: string): number | null {
  const v = readAll()[characterName];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
