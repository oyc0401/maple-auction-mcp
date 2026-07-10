# maplescouter Cloudflare 봇 차단 (실측 2026-07-11)

환산 계산기(`api.maplescouter.com`)가 **서버의 직접 `fetch`를 Cloudflare로 차단**하기 시작했다.
증상: `user_equip` / `item_hwansan`이 `scouter /api/id 403`으로 실패.

## 실측 (2026-07-11)

데이터센터/일반 서버에서 curl로 재현:

```
GET https://api.maplescouter.com/api/id?name=...&preset=00000&region=kms
→ HTTP 403 (0.11s)
server: cloudflare
<title>Attention Required! | Cloudflare</title>
<h1>Sorry, you have been blocked</h1>
```

- **즉시 403(0.11s)** — `503 "Checking your browser"` JS 챌린지가 아니라 **하드 봇 차단**(WAF/Bot Fight Mode).
- `api-key` 헤더 유무 무관, `User-Agent`·`sec-ch-ua`·`Accept-Language` 등 풀 브라우저 헤더 세트로도 403.
- `/api/id`(GET)·`/api/calc/dmg-simulator`(POST)·**사이트 루트 `maplescouter.com`까지** 전부 403.
- 판별 기준은 IP가 아니라 **브라우저 vs 비(非)브라우저**: 사용자의 집 IP에서도 Node `fetch`는 403인데 같은 IP의 크롬은 통과한다(=실제 브라우저 TLS 지문 + CF 통과 쿠키).

결론: **서버측 헤더/UA/TLS 조정으로는 통과 불가.** 실제 브라우저만 CF를 넘는다.

## 대응

넥슨 API와 동일하게 **브라우저 확장(bridge)을 경유**해 호출한다. 넥슨 호출은 원래 확장을 경유해 CF/CORS를 넘고 있었고, scouter만 서버가 직접 `fetch`하던 유일한 예외였다 — 그 예외를 없앴다.

- `extension`: 허용 호스트에 `*.maplescouter.com` 추가(https 고정), `host_permissions`에 `https://*.maplescouter.com/*`. manifest 버전 0.3.0 → 0.4.0.
- `shared`: `BridgeCommandInput.headers`(넥슨 헤더 대신 scouter 헤더를 싣는 오버라이드).
- `server`: `scouterTransport.ts`가 `BridgeLike`를 `fetch(url, init)` 형태로 감싸 `hwansan2/scouterClient`에 주입. 실패는 `scouterErrorText`가 행동 지시로 변환.

## 남은 실측 (메인테이너 확인 필요)

CF 우회가 실제로 되는지는 **로드된 확장 + maplescouter 세션이 있는 실제 브라우저**에서만 검증된다(CI엔 브라우저 없음).
확장 경유로도 403이면 브라우저에 CF 통과 기록이 없다는 뜻 → 크롬에서 `https://maplescouter.com`을 한 번 열어(캐릭터 검색 1회) CF를 통과한 뒤 재시도(`SCOUTER_BLOCKED_MSG` 안내가 이를 지시).
