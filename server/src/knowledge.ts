import { readFileSync } from 'node:fs';

// maple_knowledge.md는 사용자가 직접 관리하는 READ ONLY 원본. 리포 체크아웃이면 루트에서,
// 배포 환경이면 빌드 시 dist에 동봉된 사본에서 읽는다. 읽기는 요청 시점마다 수행 —
// 사용자가 노트를 고치면 서버 재시작 없이 다음 read부터 반영된다.
const CANDIDATES = [
  new URL('../../maple_knowledge.md', import.meta.url), // 리포 루트 (src·dist 공통)
  new URL('./maple_knowledge.md', import.meta.url), // dist 동봉 사본
];

// instructions에서 옮겨온 게임 상식. 노트 원본은 수정 금지라 서버가 덧붙인다.
const KNOWLEDGE_APPENDIX = `## 기본 상식 (서버 제공)
- 타 월드 매물 구매 시 가격의 10%가 메이플포인트로 추가 부담. 판매 수수료 3~5% (MVP 실버 이상 3%). 메소↔메이플포인트 공식 교환 가능.
- 가위 = 장착 후 재거래 가능 횟수 (플래티넘 카르마의 가위, 개당 5,900메포).
- 공퍼·데미지·방무 잠재는 무기·보조·엠블렘에만, 보공은 무기·보조에만(엠블렘 X). 메획·아획은 귀고리·반지·얼장·눈장·펜던트에만 뜸.
- 반지 4개·펜던트 2개 착용 가능. 제네시스 무기는 교환 불가.
- 같은 이름 아이템도 잠재·추옵·스타포스 여부에 따라 가격이 수백 배 차이.`;

export function loadKnowledge(): string {
  for (const url of CANDIDATES) {
    try {
      return `${readFileSync(url, 'utf-8').trimEnd()}\n\n${KNOWLEDGE_APPENDIX}`;
    } catch {
      // 다음 후보 경로 시도
    }
  }
  return KNOWLEDGE_APPENDIX;
}
