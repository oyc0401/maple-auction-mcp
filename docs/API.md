# 메이플 거래소 REST API 문서

넥슨 메이플스토리 웹 거래소(`api.mskr.nexon.com`) 비공식 API 정리 문서.

> ⚠️ 비공식 내부 API입니다. 스펙은 예고 없이 바뀔 수 있습니다.

## 공통 정보

| 항목 | 값 |
| --- | --- |
| Base URL | `https://api.mskr.nexon.com` |
| 버전 | `v1` |
| 인증 | 쿠키 기반 세션 (`auction.maplestory.nexon.com` 로그인 쿠키) |
| Content-Type | `application/json` |

## 공통 요청/응답 메타

브라우저 DevTools 네트워크 탭 기준, 모든 엔드포인트에 공통으로 관측되는 값.

| 항목 | 값 | 비고 |
| --- | --- | --- |
| Status Code (생성 성공) | `201 Created` | `POST .../searches/tool-tip` 은 검색 세션을 **생성**하므로 `200`이 아닌 `201`을 반환 |
| Remote Address | `162.159.x.x:443` (예: `162.159.140.178`) | Cloudflare 대역. `server: cloudflare` |
| CORS 허용 Origin | `https://auction.maplestory.nexon.com` | 이 출처에서만 호출 가능 (`access-control-allow-origin`) |

## 인증 · 요청 헤더

이 API는 **웹 거래소 로그인 세션 쿠키**로 인증한다. 브라우저에서 `auction.maplestory.nexon.com` 에 로그인한 상태여야 하며, 요청 시 아래 헤더/쿠키가 함께 전송된다.

> 🔒 **보안 주의**: `cookie` 안의 `NPP`, `ENC`, `_if_game_auth`, `NXCH` 등은 로그인 세션 자격증명이다. **절대 공유/커밋하지 말 것.** (본 문서에는 값 대신 `<...>` 로 마스킹)

### 필수/주요 요청 헤더

| 헤더 | 예시 값 | 설명 |
| --- | --- | --- |
| `content-type` | `application/json` | 요청 본문 형식 |
| `accept` | `application/json, text/plain, */*` | — |
| `origin` | `https://auction.maplestory.nexon.com` | CORS 허용 출처와 일치해야 함 |
| `referer` | `https://auction.maplestory.nexon.com/` | — |
| `cookie` | `PCID=<...>; ...; NPP=<...>` | **인증 핵심.** 로그인 세션 쿠키 (아래 참고) |
| `x-platform` | `PC_WEB` | 플랫폼 구분 |
| `x-device-id` | `<32자리 hex>` | 기기 식별자 |
| `user-agent` | `Mozilla/5.0 ...` | 브라우저 UA. Cloudflare 봇 검사 대상 |

### 인증 관련 쿠키

| 쿠키 | 역할 (추정) |
| --- | --- |
| `NPP` | 넥슨 인증 토큰 (세션의 핵심으로 보임) |
| `ENC` | 암호화된 인증/세션 값 |
| `_if_game_auth` | 게임 인증 UUID |
| `NXCH` | 넥슨 계정 정보 (OID/닉네임 등 포함) |
| `A2SK` | 세션 관련 토큰 |
| `__cf_bm`, `_cfuvid` | Cloudflare 봇 관리 쿠키 |

> 나머지 쿠키(`_ga*`, `_fbp`, `_hj*` 등)는 분석/광고용으로 인증과 무관해 보인다.

### CORS 프리플라이트 (서버 응답)

서버가 `OPTIONS` 응답에서 허용하는 값. 커스텀 헤더로 인증/기기 정보를 받도록 설정돼 있다.

| 응답 헤더 | 값 |
| --- | --- |
| `access-control-allow-origin` | `https://auction.maplestory.nexon.com` |
| `access-control-allow-methods` | `GET, PUT, POST, DELETE, PATCH, OPTIONS` |
| `access-control-allow-credentials` | `true` (쿠키 전송 허용) |
| `access-control-allow-headers` | `X-Device-Uuid, X-Device-Model, X-Device-Emulator, True-Client-IP, X-Platform, X-Device-Id, x-transaction-key, ..., Content-Type, Authorization` |
| `access-control-max-age` | `1728000` (20일) |

> ℹ️ 허용 헤더에 `Authorization`, `x-transaction-key`, `True-Client-IP` 등이 포함돼 있어, 웹 외 클라이언트에서는 토큰 기반 인증도 지원할 가능성이 있다(웹은 쿠키 사용).

## 엔드포인트 목록

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| `POST` | `/v1/market/web/items/searches/tool-tip` | [아이템 검색 (툴팁 포함)](./아이템-검색-tooltip.md) |
| `GET` | `/v1/market/web/items/searches/{searchKey}/tool-tip` | [아이템 검색 결과 조회 (페이지네이션)](./아이템-검색-페이지네이션.md) |


