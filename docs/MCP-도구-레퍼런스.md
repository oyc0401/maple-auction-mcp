# MCP 도구 레퍼런스 (AI가 보는 도구)

`maple-auction` MCP 서버가 노출하는 도구는 **8개**다. 모든 매물(`items[]`)은 압축 요약 형태이며, 필드 의미는 [응답 예시 문서](./응답-예시-풀옵션-아이템.md)를 참고한다.

| 도구 | 용도 | 검색 횟수 |
| --- | --- | :---: |
| `search_items` | 이름 위주 빠른 검색 | 1회 소진 |
| `search_weapon` | 무기 상세 검색 (전체 필터) | 1회 소진 |
| `search_armor` | 방어구·장신구 상세 검색 (전체 필터) | 1회 소진 |
| `get_page` | 검색 결과 정렬·페이지 조회 | 무료 |
| `recent_sold` | 최근 시세 (판매 완료 매물) | 무료 |
| `list_characters` | 계정 캐릭터 목록 (월드 이름 포함) | 무료 |
| `set_character` | 검색 기준 캐릭터(월드) 전환 | 무료 |
| `get_status` | 연결·계정·잔여 횟수 확인 | 무료 |

**기본 흐름**: `search_items`(또는 `search_weapon`/`search_armor`)로 검색(일일 검색 1회 소진) → 응답의 `searchKey`로 `get_page`를 정렬·페이지 바꿔가며 자유롭게 조회(무료).

**상세 필터 검색** (`search_weapon` / `search_armor`): 웹 거래소의 검색 필터 전체를 지원한다 — `subCategory`(하위 분류), `jobClass`(직업군), `priceMin/Max`, `levelMin/Max`, `starforceMin/Max`, `potentialGrade`/`additionalPotentialGrade`(0없음~4레전드리), `potentialOptions`/`additionalPotentialOptions`(`[{option, minValue}]`, 기본 합산 모드 — `potentialSum: false`로 줄별 개별 충족), `extraOptions`(추옵), `scrollOptions`(주문서 누적), `remainUpgradeCountMin/Max`, `cuttableCountMin/Max`/`uncuttable`, `isBindedWhenEquipped`, `isExOptExtractable`/`isPotentialExtractable`, `myWorldOnly`(현재 월드만), 방어구는 `seedRingLevelMin/Max`(특수 스킬 반지). 옵션 키·카테고리 코드 목록은 `server/src/constants.ts` 참고.

예 — 에디셔널 공격력 합 21% 이상인 체인(현재 월드만):

```json
{ "subCategory": "WEAPON_ONE_HANDED_CHAIN",
  "additionalPotentialOptions": [{ "option": "physicalAttackPercent", "minValue": 21 }],
  "myWorldOnly": true }
```

**최근 시세** (`recent_sold`): 판매 완료된 매물 목록. 검색 횟수를 소진하지 않아 시세 파악에 우선 사용.

**캐릭터 전환** (`list_characters` → `set_character`): 거래소는 월드(그룹) 단위이므로 다른 월드 캐릭터로 전환하면 그 월드 매물이 검색된다. `get_status`의 `identity.worldName`으로 현재 기준 월드를 확인할 수 있다.

---

## 1. `search_items` — 검색 (세션 생성)

거래소를 검색해 **가격 낮은순 10개**와 `searchKey`를 반환한다. 더 많은 결과·다른 정렬·다음 페이지는 `get_page`로 본다.

> ⚠️ 이 호출은 **일일 검색 횟수를 1회 소진**한다. 응답의 `searchRemaining`으로 남은 횟수를 확인할 수 있다. 같은 조건을 정렬만 바꿔 보려면 재검색하지 말고 `get_page`를 쓸 것(무료).

### 파라미터

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | :---: | --- |
| `keyword` | `string` | ✅ | 아이템 이름 검색어 |
| `exactMatch` | `boolean` | | 정확히 일치 (기본 `false`) |
| `category` | `string` | | 카테고리. 검증된 값: `"WEAPON"` |
| `potentialGrade` | `number` | | 잠재등급: `0`없음 `1`레어 `2`에픽 `3`유니크 `4`레전드리 |

*정렬·페이지·개수는 지정 불가(고정: 가격 낮은순 10개). 그건 `get_page`에서 한다.*

### 응답

```json
{
  "total": 688,
  "page": 1,
  "limit": 10,
  "totalPages": 69,
  "hasNext": true,
  "searchKey": "7ff4bcdb-5fd4-47ec-9280-cfe11ec3bf8c",
  "items": [ /* 요약 매물 (§매물 요약 필드) */ ],
  "searchRemaining": 97
}
```

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `total` | `number` | 조건에 맞는 전체 매물 수 |
| `page` / `limit` / `totalPages` | `number` | 현재 페이지 / 페이지 크기(10) / 전체 페이지 수 |
| `hasNext` | `boolean` | 다음 페이지 존재 여부 |
| `searchKey` | `string` | 이 검색 세션 키. `get_page`에 넘긴다 |
| `items` | `object[]` | 매물 요약 배열 (아래 §매물 요약 필드) |
| `searchRemaining` | `number \| null` | **남은 일일 검색 생성 횟수** (조회 실패 시 `null`) |

**오류 시**: 문자열 안내를 반환한다. 미로그인이면 `"넥슨 로그인이 필요합니다. … nxlogin.nexon.com/auth/login …"`, 확장 미연결이면 확장 설치 안내.

---

## 2. `get_page` — 페이지·정렬 조회 (무료)

`search_items`가 준 `searchKey`로 원하는 **정렬·페이지·크기**의 결과를 조회한다. GET만 쓰므로 **일일 검색 횟수를 소진하지 않는다.** 키가 만료됐으면 같은 조건으로 자동 재검색한다(이때만 검색 1회 소진).

### 파라미터

| 이름 | 타입 | 필수 | 기본 | 설명 |
| --- | --- | :---: | --- | --- |
| `searchKey` | `string` | ✅ | | `search_items` 응답의 `searchKey` |
| `page` | `number` | | `1` | 페이지 번호 (1부터) |
| `limit` | `20 \| 40 \| 60` | | `20` | 페이지 크기. **20/40/60만 허용** (그 외는 거부) |
| `sort` | `enum` | | `PRICE_PER_ITEM_ASC` | 정렬값(아래). **유효값 외는 거부** |

#### 정렬값 (`sort`)

| 값 | 의미 |
| --- | --- |
| `ITEM_NAME_ASC` | 이름 가나다순 |
| `PRICE_PER_ITEM_ASC` | 개당 가격 낮은 순 |
| `PRICE_DESC` | 가격 높은 순 |
| `ATTACK_POWER_DESC` | 전투력 증가량 높은 순 |
| `END_DATE_ASC` | 판매 종료 임박순 |
| `REGISTER_DATE_DESC` | 최신 등록순 |

### 응답

```json
{
  "total": 688,
  "page": 2,
  "limit": 20,
  "totalPages": 35,
  "hasNext": true,
  "searchKey": "7ff4bcdb-5fd4-47ec-9280-cfe11ec3bf8c",
  "items": [ /* 요약 매물 */ ]
}
```

`search_items` 응답과 동일 구조(단, `searchRemaining` 없음). `hasNext`가 `true`면 `page`를 늘려 다음 페이지를 본다.

---

## 3. `get_status` — 연결·계정 상태

크롬 확장 연결 여부와 로그인 계정, 남은 검색/등록 횟수를 확인한다. 파라미터 없음.

### 응답 (정상)

```json
{
  "connected": true,
  "identity": { "worldId": 5, "accountId": 12345678, "characterId": 87654321, "characterName": "홍길동", "worldName": "크로아" },
  "dailyLimit": { "search": { "limit": 100, "remaining": 97 }, "register": { "limit": 20, "remaining": 20 } }
}
```

- 확장 미연결: `"크롬 확장이 연결되어 있지 않습니다. …"` 문자열.
- 로그인 안 됨(계정 못 찾음): `{ "connected": true, "identity": null, "note": "…로그인 안내…" }`.

---

## 매물 요약 필드 (`items[]`)

두 검색 도구가 반환하는 각 매물의 요약 구조. 전체 예시·상세는 [응답 예시 문서](./응답-예시-풀옵션-아이템.md).

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `id` | `string` | 매물 고유 ID (`{tradeSn}:{subIdx}`) |
| `name` | `string` | 아이템 이름 |
| `price` | `number` | 개당 가격(메소). 총가는 `price × quantity` |
| `quantity` | `number` | 수량 |
| `starforce` | `number` | 스타포스 강화 수치 |
| `scroll` | `string \| null` | `"강화 N회 (남은 횟수 x / 복구가능 y / 총 z)"` |
| `powerDiff` | `number \| null` | 전투력 증가량(현재 장비 대비, 음수 가능). 착용 불가 아이템이면 `null` |
| `isMyWorld` | `boolean` | 내 월드 매물 여부. `false`면 구매 시 **가격의 10% 메이플포인트 수수료** |
| `isAmazingHyperUpgradeUsed` | `boolean` | 놀라운 장비강화 주문서(놀장) 사용 여부 |
| `finalStat` | `object \| null` | 최종 합산 스탯(고정 키, 0도 표기): `str/dex/int/luk/all/pad/mad/mhp/dam/bdr/imdr` |
| `exOption` | `string \| null` | 추가옵션 항목 (`"마력 +33 / INT +40 / ..."`) |
| `potential` | `string \| null` | 잠재능력 (`"레전드리: 옵션 / 옵션 / ..."`) |
| `additional` | `string \| null` | 에디셔널 잠재능력 (동일 형식) |
| `exceptional` | `string \| null` | 익셉셔널 강화 내역 |
| `soul` | `string \| null` | 소울 `"이름 / 옵션"` |
| `tradeDesc` | `string \| null` | 거래 설명 (`"1회 교환 가능 … · (가위: 7 / 10)"`). 가위=플래티넘 카르마(5,900메포, 월 1회 마일리지 구매 가능) — 잔여 횟수 많을수록 가치↑ |
| `endDate` | `string` | 판매 등록 만료 일시 (ISO 8601, UTC) |
| `wishlist` | `number` | 찜한 사람 수 |
