# 개인정보 처리방침 (Privacy Policy)

**Maple Auction MCP** 크롬 확장 프로그램

- 시행일: 2026년 7월 8일
- 문의: oycshare@gmail.com

## 개요

Maple Auction MCP(이하 "본 확장")는 메이플스토리 경매장(거래소) 검색 MCP 서버를 위한 **로컬 브릿지**입니다. 사용자의 브라우저에 이미 존재하는 넥슨 로그인 세션을 이용해 넥슨 API를 호출하고, 그 결과를 사용자 본인의 컴퓨터에서 실행 중인 MCP 서버로 전달하는 역할만 수행합니다.

**본 확장은 어떠한 개인정보도 개발자나 제3자 서버로 수집·전송·저장하지 않습니다.**

## 1. 처리하는 정보

본 확장은 동작 과정에서 다음 정보를 **일시적으로** 다룹니다.

| 정보 | 용도 |
|---|---|
| 넥슨 로그인 세션 쿠키 | 브라우저가 `*.nexon.com` API 요청 시 자동으로 첨부 (`credentials: include`). 본 확장은 쿠키 값을 직접 읽거나 저장하지 않습니다. |
| 넥슨 계정 ID, 게임 캐릭터 정보(월드, 캐릭터 ID·이름·레벨) | 경매장 API 호출에 필요한 사용자 캐릭터를 식별하기 위해 넥슨 API로부터 조회 |
| 경매장(거래소) 검색 요청 및 결과 | MCP 서버의 요청을 대신 수행하고 결과를 반환 |

## 2. 정보의 전송 범위

처리된 모든 정보는 다음 두 곳 사이에서만 이동합니다.

1. **넥슨 공식 서버** (`https://*.nexon.com`) — API 호출 대상
2. **사용자 본인의 컴퓨터에서 실행 중인 로컬 MCP 서버** (`127.0.0.1`, 로컬 WebSocket)

개발자 서버, 분석(analytics) 서비스, 광고 네트워크 등 **외부 제3자에게 전송되는 정보는 일절 없습니다.**

## 3. 정보의 저장

본 확장은 어떠한 정보도 영구 저장하지 않습니다.

- `chrome.storage`, `localStorage`, IndexedDB 등 브라우저 저장소를 사용하지 않습니다.
- 모든 데이터는 요청 처리 중 메모리에만 존재하며, 처리 완료 즉시 폐기됩니다.

## 4. 요청하는 권한과 사유

| 권한 | 사유 |
|---|---|
| `host_permissions: https://*.nexon.com/*` | 사용자의 로그인 세션으로 넥슨 경매장·계정 API를 호출하기 위해 필요 |
| `alarms` | 로컬 MCP 서버와의 WebSocket 연결이 끊어졌을 때 주기적으로 재연결하기 위해 필요 |

## 5. 판매 및 제3자 제공

본 확장은 사용자 데이터를 판매하거나, 대가를 받고 제공하거나, 본 처리방침에 명시된 목적 외로 사용하지 않습니다.

## 6. 아동의 개인정보

본 확장은 아동을 대상으로 하지 않으며, 아동의 개인정보를 의도적으로 수집하지 않습니다.

## 7. 처리방침의 변경

본 처리방침이 변경되는 경우 이 문서를 갱신하고 시행일을 수정합니다. 중요한 변경이 있는 경우 확장 프로그램 업데이트 노트를 통해 고지합니다.

## 8. 문의

개인정보 처리와 관련한 문의는 아래로 연락해 주세요.

- 이메일: oycshare@gmail.com

---

# Privacy Policy (English)

**Maple Auction MCP** Chrome Extension — Effective July 8, 2026

Maple Auction MCP is a local bridge for a MapleStory auction-house search MCP server. It calls Nexon APIs using the Nexon login session already present in your browser, and relays the results only to an MCP server running on your own machine (`127.0.0.1`).

**This extension does not collect, transmit, or store any personal data to the developer or any third party.**

- **Data handled (in memory only):** Nexon account ID, game character info (world, character ID/name/level), and auction search requests/results. Login cookies are attached automatically by the browser (`credentials: include`); the extension never reads or stores cookie values.
- **Data flow:** exclusively between official Nexon servers (`https://*.nexon.com`) and your local MCP server (`127.0.0.1` via local WebSocket). No analytics, no ads, no developer servers.
- **Storage:** none. The extension uses no `chrome.storage`, `localStorage`, or IndexedDB; all data is discarded after each request.
- **Permissions:** `https://*.nexon.com/*` (call Nexon APIs with your session), `alarms` (periodic reconnection to the local WebSocket).
- **No sale or sharing** of user data, ever.

Contact: oycshare@gmail.com
