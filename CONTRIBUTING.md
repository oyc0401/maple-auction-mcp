# 기여 가이드

기여 환영합니다. 이 프로젝트는 구조가 다소 특이하므로(MCP 서버 ↔ 크롬 확장 브리지) 시작 전에 이 문서를 꼭 읽어주세요.

## 아키텍처 한눈에

```
AI 클라이언트 (Claude 등)
   │ stdio (MCP)
   ▼
server/   MCP 서버 (Node) ── ws://127.0.0.1:29171 ──▶ extension/  크롬 확장 (MV3 SW)
   ▲                                                     │ 넥슨 로그인 쿠키로 fetch
shared/   공용 타입                                       ▼
                                            api.mskr.nexon.com (비공식 API)
```

- **server/** — MCP 도구 정의(`mcp.ts`), API 바디 조립(`mapping.ts`), 응답 요약(`summarize.ts`), 실측 상수(`constants.ts`)
- **extension/** — WebSocket으로 서버 명령을 받아 넥슨 API를 대신 호출 (쿠키 인증)
- **docs/** — 비공식 API 실측 문서. 스펙 출처가 전부 여기 있습니다

## 개발 환경

```bash
pnpm install
pnpm test        # vitest (네트워크 불필요, 실측 픽스처 기반)
pnpm typecheck
pnpm build
```

실제 연동 테스트가 필요하면:
1. `chrome://extensions` → 개발자 모드 → `extension/` 폴더 로드
2. 크롬에서 [메이플 옥션](https://auction.maplestory.nexon.com) 로그인
3. MCP 클라이언트에 `server/dist/index.js` 등록 (`node dist/index.js`, stdio)

## ⚠️ 검색 횟수 규칙 (중요)

넥슨 API의 검색 생성(`POST /searches/tool-tip`)은 **계정당 일 100회 제한**입니다. 개발 중 낭비하지 마세요.

- 소진되는 건 성공한 검색 POST(201)뿐 — GET류(`get_page`, daily-limit, 인증 API), `recent_sold`, 400 응답은 무료
- **API 스키마 검증은 실제 POST 대신**: 경매장 페이지 콘솔에서 fetch/XHR을 몽키패치해 요청을 차단하고 바디만 캡처하세요 (소진 0회). 웹 UI에 필터를 걸고 검색 버튼을 누르면 실제 바디가 잡힙니다
- 필드명·enum은 페이지 번들 JS(`assets/index-*.js`)에서 추출할 수 있습니다
- 새로 알아낸 스펙은 `docs/`에 실측 날짜와 함께 기록해주세요

## PR 규칙

- **테스트가 스펙입니다.** 동작을 바꾸는 PR은 같은 PR에서 테스트도 갱신하세요. CI(typecheck + test + build)가 초록이어야 머지됩니다
- 실측으로 확인한 값만 커밋하세요. 추측한 필드명/enum은 코멘트에 "추정"을 명시
- 커밋 메시지는 한국어, `feat:`/`fix:`/`docs:`/`chore:` 프리픽스 사용
- 성급한 추상화 금지 — 지금 필요한 것만

## 보안

- 넥슨 세션 쿠키·계정 정보를 코드/문서/이슈에 절대 포함하지 마세요 (docs의 예시는 전부 마스킹)
- 취약점 발견 시 공개 이슈 대신 메인테이너에게 연락해주세요
