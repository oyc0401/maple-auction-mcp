import { readFileSync } from 'node:fs';

// maple_knowledge.md는 사용자가 직접 관리하는 READ ONLY 원본이자 지식의 단일 소스.
// 리포 체크아웃이면 루트에서, 배포 환경이면 빌드 시 dist에 동봉된 사본에서 읽는다.
// 읽기는 요청 시점마다 수행 — 사용자가 노트를 고치면 서버 재시작 없이 다음 read부터 반영된다.
const CANDIDATES = [
  new URL('../../maple_knowledge.md', import.meta.url), // 리포 루트 (src·dist 공통)
  new URL('./maple_knowledge.md', import.meta.url), // dist 동봉 사본
];

export function loadKnowledge(): string {
  for (const url of CANDIDATES) {
    try {
      return readFileSync(url, 'utf-8');
    } catch {
      // 다음 후보 경로 시도
    }
  }
  return '지식 노트(maple_knowledge.md)를 찾지 못했습니다. 배포본이 손상되었을 수 있으니 재설치가 필요합니다.';
}
