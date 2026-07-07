# 아이템 검색 (툴팁 포함)

거래소에 등록된 아이템을 조건으로 검색하고, 각 매물의 상세 툴팁(스탯 · 잠재 · 세트효과 등)까지 함께 받아온다.

```
POST /v1/market/web/items/searches/tool-tip
```

| 항목 | 값 |
| --- | --- |
| 메서드 | `POST` |
| 경로 | `/v1/market/web/items/searches/tool-tip` |
| Content-Type | `application/json` |

---

## 요청 (Request)

### Body

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | :---: | --- |
| `worldId` | `number` | ✅ | 월드(서버) ID. 예: `5` |
| `accountId` | `number` | ✅ | 요청 계정 ID |
| `characterId` | `number` | ✅ | 요청 캐릭터 ID |
| `page` | `number` | ✅ | 페이지 번호 (1부터 시작) |
| `limit` | `number` | ✅ | 페이지당 아이템 수. 예: `20` |
| `sortType` | `string` | ✅ | 정렬 기준. [정렬 타입](#정렬-타입-sorttype) 참고 |
| `saveRecentKeyword` | `boolean` | | 검색어를 최근 검색어로 저장할지 여부 |
| `filters` | `object` | ✅ | 검색 필터. [필터](#필터-filters) 참고 |

### 필터 (`filters`)

2026-07-08, 웹 거래소의 실제 POST 바디를 fetch 인터셉트로 캡처해 확인한 전체 스키마.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `keyword` | `string` | 검색어. **빈 문자열이면 400** — 없으면 필드 자체를 생략 |
| `exactMatch` | `boolean` | 정확히 일치 검색 여부 |
| `itemCategory.itemDetailCategory` | `string` | 세부 카테고리. 예: `"WEAPON"`, `"ARMOR_ARMOR"`, `"WEAPON_ONE_HANDED_CHAIN"` (계층 코드 전부 유효) |
| `itemCategory.itemJobCategory` | `string` | 직업군: `WARRIOR` `MAGE` `ARCHER` `THIEF` `PIRATE` |
| `price.min` / `price.max` | `string` | 가격 범위 (메소, **문자열**) |
| `basicOption.levelMin/Max` | `number` | 착용 레벨 범위 |
| `enhancementOption.starforceMin/Max` | `number` | 스타포스 범위 |
| `enhancementOption.potentialGrade` | `number` | 잠재 등급 ([등급 코드](#등급-코드-grade)) |
| `enhancementOption.additionalPotentialGrade` | `number` | 에디셔널 등급 (동일 코드) |
| `enhancementOption.potentialOptionSum` | `object` | 잠재 옵션 **합산** 필터: `{ physicalAttackPercent: 21 }` |
| `enhancementOption.potentialOptions` | `object[]` | 잠재 옵션 **개별** 필터: `[{ physicalAttackPercent: 9 }, ...]` (줄마다 단일 키) |
| `enhancementOption.additionalPotentialOptionSum` / `additionalPotentialOptions` | 〃 | 에디셔널 잠재, 형태 동일 |
| `enhancementOption.ex*` | `number` | 추가 옵션 최소값을 바로 키로: `exMaxHp`, `exPhysicalAttack`, `exBossDamagePercent`, `exAllStatsPercent`, `exReducedLevelReq` 등 |
| `enhancementOption.scroll*` | `number` | 주문서 누적 강화치: `scrollPhysicalAttack`, `scrollStr`, `scrollMaxHp` 등 8종 |
| `enhancementOption.remainUpgradeCountMin/Max` | `number` | 주문서 강화 잔여 횟수 |
| `etcOption.seedRingLevelMin/Max` | `number` | 특수 스킬 반지 레벨 |
| `etcOption.cuttableCountMin/Max` | `number` | 가위 사용 가능 횟수 |
| `etcOption.uncuttable` | `boolean` | 가위 횟수 미부여만 (cuttableCount와 동시 사용 불가) |
| `etcOption.isBindedWhenEquipped` | `boolean` | 장착 시 교환 불가만 |
| `etcOption.isExOptExtractable` | `boolean` | 추가 옵션 추출 가능만 |
| `etcOption.isPotentialExtractable` | `boolean` | 잠재 추출 가능만 |
| `myWorldOnly` | `boolean` | 현재 월드 아이템만 |

잠재/에디셔널 옵션 키 전체 목록과 카테고리 코드는 `server/src/constants.ts` 참고.

#### 최근 시세 (판매 완료 매물)

`POST /v1/market/web/items/searches/sold/recent` — body는 `{worldId, accountId, characterId}`만.
**일일 검색 횟수를 소진하지 않는다** (실측 2026-07-08).

### 정렬 타입 (`sortType`)

| 값 | 설명 |
| --- | --- |
| `PRICE_PER_ITEM_ASC` | 개당 가격 오름차순 |
| `PRICE_PER_ITEM_DESC` | 개당 가격 내림차순 (추정) |

> 그 외 정렬 값은 확인되는 대로 추가.

### 요청 예시

```json
{
  "worldId": 5,
  "accountId": 12345678,
  "characterId": 87654321,
  "page": 1,
  "limit": 20,
  "sortType": "PRICE_PER_ITEM_ASC",
  "saveRecentKeyword": true,
  "filters": {
    "keyword": "아케인셰이드 가즈",
    "exactMatch": true,
    "itemCategory": {
      "itemDetailCategory": "WEAPON"
    },
    "enhancementOption": {
      "potentialGrade": 4
    }
  }
}
```

---

## 응답 (Response)

### 최상위 구조

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `items` | `Item[]` | 검색된 매물 목록. [Item](#item-객체) 참고 |
| `page` | `number` | 현재 페이지 번호 |
| `limit` | `number` | 페이지당 아이템 수 |
| `total` | `number` | 전체 검색 결과 수. 예: `395` |
| `totalPages` | `number` | 전체 페이지 수. 예: `20` |
| `hasNext` | `boolean` | 다음 페이지 존재 여부 |
| `searchKey` | `string` (UUID) | 이번 검색 세션 키 |

---

## Item 객체

한 매물(거래 슬롯) 단위. 거래 메타데이터 + 상세 툴팁(`toolTip`)으로 구성.

### 매물 · 거래 정보

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `_id` | `string` | 매물 고유 ID (`{tradeSn}:{subIdx}` 형태) |
| `tradeSn` | `string` | 거래 시리얼 |
| `subIdx` | `number` | 거래 내 하위 인덱스 |
| `isMyWorld` | `boolean` | 내 월드 매물 여부 |
| `itemIcon` | `object` | 아이콘 정보. [itemIcon](#itemicon) 참고 |
| `encryptedItemId` | `string` | 암호화된 아이템 ID |
| `itemName` | `string` | 아이템 이름 |
| `toolTipType` | `number` | 툴팁 유형 코드 |
| `bundleLabel` | `string \| null` | 묶음 라벨 |
| `isCash` | `boolean` | 캐시 아이템 여부 |
| `gender` | `string` | 성별 제한 (`NONE` / `MALE` / `FEMALE`) |
| `itemCode` | `string` | 아이템 인코딩 코드(Base64) |
| `currentUpgradeCount` | `number` | 현재 주문서 강화 횟수 |
| `starforce` | `number` | 스타포스 강화 수치 |
| `seedRingLevel` | `number` | 시드링 레벨 |
| `royalSpecialType` | `number` | 로얄/스페셜 유형 코드 |
| `eventLabel` | `string \| null` | 이벤트 라벨 |
| `limitedLabel` | `string \| null` | 기간한정 라벨 |
| `illusionRingGrade` | `string \| null` | 일루전 링 등급 |
| `petGrade` | `number` | 펫 등급 |
| `isLookChange` | `boolean` | 외형 변경 여부 |
| `quantity` | `number` | 수량 |
| `price` | `string` | 총 가격 (메소, 문자열) |
| `pricePerItem` | `string` | 개당 가격 (메소, 문자열) |
| `wishlistCount` | `number` | 찜 횟수 |
| `endDate` | `string` (ISO 8601) | 판매 종료 일시 |
| `status` | `string` | 판매 상태. 예: `ON_SALE` |
| `tradeDate` | `string \| null` | 거래 완료 일시 |
| `isMyItem` | `boolean` | 내 매물 여부 |
| `isDrawNumberItem` | `boolean` | 수량 지정 매물 여부 |
| `isTreatSingly` | `boolean` | 낱개 취급 여부 |
| `isDrawPricePerUnit` | `boolean` | 개당 가격 표기 여부 |
| `isPreviewable` | `boolean` | 미리보기 가능 여부 |
| `isBuyAllUnderPrice` | `boolean` | 지정가 이하 일괄구매 여부 |
| `isTradeOnceItem` | `boolean` | 1회 교환 아이템 여부 |
| `priceDrawType` | `string` | 가격 표기 유형. 예: `Equip` |
| `bundleCount` | `number \| null` | 묶음 수량 |
| `attackPowerDiff` | `number \| null` | **전투력 증가량** — 이 아이템 착용 시 현재 장비 대비 증감(음수 가능). 캐릭터가 **착용 가능한** 아이템에만 값이 오고, 착용 불가(다른 직업 무기 등)면 `null`. (실측 2026-07-08: 카데나 캐릭터로 체인 검색 시 값, 케인/가즈는 `null`) |
| `attackPowerDiffPerSlot` | `number \| null` | 슬롯당 전투력 증가량 (관측상 대부분 `null`) |
| `toolTip` | `object` | 상세 툴팁. [toolTip](#tooltip-객체) 참고 |

### itemIcon

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `fallBackUrl` | `string` | 아이콘 이미지 URL |
| `encryptedLookItemId` | `string` | 암호화된 외형 아이템 ID |

---

## toolTip 객체

인게임 아이템 툴팁에 대응하는 상세 정보.

### 기본 정보

| 필드                          | 타입                  | 설명                                                                         |
| --------------------------- | ------------------- | -------------------------------------------------------------------------- |
| `starforce`                 | `number`            | 현재 스타포스                                                                    |
| `starforceMax`              | `number`            | 최대 스타포스                                                                    |
| `titleInfo`                 | `object`            | 칭호 정보 (`titleType`, `title`, `isMeister`, `isMasterItem`)                  |
| `itemIcon`                  | `object`            | 아이콘 ([itemIcon](#itemicon)과 동일 구조)                                         |
| `isProtected`               | `boolean`           | 보호 여부                                                                      |
| `isProtectedGreenZone`      | `boolean`           | 그린존 보호 여부                                                                  |
| `isPermanentlyAttributed`   | `boolean`           | 영구 귀속 여부                                                                   |
| `isAmazingHyperUpgradeUsed` | `boolean`           | 놀라운 장비강화 주문서 사용 여부                                                         |
| `vestige`                   | `boolean`           | 흔적 여부                                                                      |
| `itemName`                  | `string`            | 아이템 이름                                                                     |
| `itemDesc`                  | `string \| null`    | 아이템 설명                                                                     |
| `faceEmotionLook`           | `object \| null`    | 표정/외형 정보                                                                   |
| `gradeInfo`                 | `object`            | 등급 정보 (`isSpecialGrade`, `royalSpecialType`, `eventLabel`, `limitedLabel`) |
| `cashDesc`                  | `string[]`          | 캐시 설명                                                                      |
| `tradeDesc`                 | `string[]`          | 거래 관련 설명. 예: `"1회 교환 가능 (거래 후 교환 불가)"`                                     |
| `expireDesc`                | `string`            | 만료 설명                                                                      |
| `abilityExpireDesc`         | `string[]`          | 능력 만료 설명                                                                   |
| `attackPower`               | `number \| null`    | 공격력(요약값)                                                                   |
| `categories`                | `string[]`          | 분류. 예: `["무기","두손","아대"]`                                                  |
| `lookItem`                  | `object \| null`    | 외형 아이템                                                                     |
| `reqJob`                    | `string`            | 착용 가능 직업. 예: `"도적"`                                                        |
| `unwearableJobNames`        | `string[]`          | 착용 불가 직업 목록                                                                |
| `reqLevel`                  | `number`            | 착용 요구 레벨                                                                   |
| `reqGender`                 | `string \| null`    | 착용 성별 제한                                                                   |
| `androidPreview`            | `object \| null`    | 안드로이드 미리보기                                                                 |
| `androidGrade`              | `string \| null`    | 안드로이드 등급                                                                   |
| `setEffects`                | `string[]`          | 세트 효과명 목록                                                                  |
| `setItemInfo`               | `object \| null`    | 세트 상세. [setItemInfo](#setiteminfo-세트-정보) 참고                                |
| `skillNames`                | `string[] \| null`  | 스킬명 목록                                                                     |
| `seedRingType`              | `number`            | 시드링 유형                                                                     |
| `seedRingTotalInfo`         | `object \| null`    | 시드링 종합 정보                                                                  |
| `seedRingLevel`             | `number`            | 시드링 레벨                                                                     |
| `attackSpeed`               | `string`            | 공격 속도. 예: `"6단계"`                                                          |
| `stat`                      | `StatBlock`         | **최종 합산** 스탯. [StatBlock](#statblock-스탯-블록) 참고                             |
| `baseStat`                  | `StatBlock`         | 기본 스탯                                                                      |
| `starforceStat`             | `StatBlock`         | 스타포스 증가분                                                                   |
| `upgradeStat`               | `StatBlock`         | 주문서 강화 증가분                                                                 |
| `exOptionStat`              | `StatBlock`         | 추가옵션 증가분                                                                   |
| `timeLimitedStat`           | `StatBlock`         | 기간한정 증가분                                                                   |
| `cashOptionStat`            | `StatBlock \| null` | 캐시 옵션 스탯                                                                   |
| `preventSlip`               | `boolean`           | 미끄럼 방지                                                                     |
| `supportWarm`               | `boolean`           | 보온 지원                                                                      |
| `upgradeInfo`               | `object`            | 강화 상세. [upgradeInfo](#upgradeinfo-강화-정보) 참고                                |
| `soulWeapon`                | `object`            | 소울 정보 (`status`, `soulName`, `optionText`, `skillName`)                    |
| `exceptionalUpgrade`        | `object \| null`    | 익셉셔널 강화                                                                    |
| `mvpGrade`                  | `string \| null`    | MVP 등급                                                                     |
| `attributeInfo`             | `object`            | 속성 정보 (`descs`, `itemLimit`, `seedRingLimit`)                              |
| `addition`                  | `object \| null`    | 부가 정보                                                                      |
| `epicDesc`                  | `string \| null`    | 에픽 설명                                                                      |
| `variableStat`              | `object \| null`    | 가변 스탯                                                                      |
| `illusionRingGrade`         | `string \| null`    | 일루전 링 등급                                                                   |
| `descs`                     | `string[]`          | 기타 설명                                                                      |
| `growthDescs`               | `array`             | 성장 설명                                                                      |
| `specificTargetDescs`       | `array`             | 특정 대상 설명                                                                   |
| `prismColorInfo`            | `object \| null`    | 프리즘 색상 정보                                                                  |
| `prismPartName`             | `string \| null`    | 프리즘 부위명                                                                    |
| `prismColor`                | `string \| null`    | 프리즘 색상                                                                     |
| `symbolGrowth`              | `object \| null`    | 심볼 성장                                                                      |
| `normalGrowth`              | `object \| null`    | 일반 성장                                                                      |

### StatBlock (스탯 블록)

`stat`, `baseStat`, `starforceStat` 등에서 **공통으로 쓰이는** 스탯 구조. 모든 필드는 `number`.

| 키 | 의미 |
| --- | --- |
| `str` / `dex` / `int` / `luk` | STR / DEX / INT / LUK |
| `all` | 올스탯 (%) |
| `pad` | 공격력 |
| `mad` | 마력 |
| `pdd` | 방어력 |
| `mdf` | 마법 방어 (추정) |
| `mhp` / `mmp` | 최대 HP / 최대 MP |
| `hpr` / `mpr` | HP 회복 / MP 회복 |
| `speed` / `jump` | 이동속도 / 점프력 |
| `dam` | 데미지 (%) |
| `bdr` | 보스 몬스터 데미지 (%) |
| `imdr` | 몬스터 방어율 무시 (%) |
| `arc` / `aut` | 아케인포스 / 어센틱포스 |
| `reduceReq` / `incReq` | 착용 요구 레벨 감소 / 증가 |
| `addExpr` | 추가 경험치 (추정) |
| `expRate` | 경험치 획득량 (%) |
| `srExpRate` / `srMesoRate` / `srDropRate` | 경험치 / 메소 / 아이템 드롭률 (추정) |
| `pqExpRate` | 파티 퀘스트 경험치 (추정) |
| `chuc` | 추가 강화 관련 (추정) |
| `craft` | 제작 관련 (추정) |

> `추정` 표시 필드는 실제 인게임 표기와 대조 후 확정 필요.

### setItemInfo (세트 정보)

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `encryptedSetItemId` | `string` | 암호화된 세트 ID |
| `setItemName` | `string` | 세트 이름 |
| `completeCount` | `number` | 완성 부위 수 |
| `parts` | `object[]` | 세트 구성 부위 |
| `parts[].typeName` | `string` | 부위명. 예: `"모자"` |
| `parts[].representName` | `string` | 대표 아이템명 |
| `parts[].itemIds` | `string[]` | 해당 부위 아이템 ID 목록 |
| `parts[].memberNames` | `string[]` | 구성원 이름 |
| `effects` | `object[]` | 세트 효과 |
| `effects[].partsCount` | `number` | 발동 세트 수 |
| `effects[].descriptions` | `string[]` | 해당 단계 효과 설명 |

### upgradeInfo (강화 정보)

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `disabledSummary` | `string` | 강화 불가 요약 |
| `starForce` | `object` | 스타포스 (`current`, `max`, `canUpgrade`, `description`) |
| `scroll` | `object` | 주문서 (`current`, `remaining`, `failure`, `max`, `canUpgrade`, `description`) |
| `exOption` | `object` | 추가옵션 (`sum`, `canUpgrade`, `entries[]`, `description`) |
| `potential` | `object` | 잠재능력 ([PotentialBlock](#potentialblock)) |
| `additionalPotential` | `object` | 에디셔널 잠재능력 ([PotentialBlock](#potentialblock)) |

#### PotentialBlock

`potential` / `additionalPotential` 공통 구조.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `grade` | `number` | 잠재 등급 코드 ([등급 코드](#등급-코드-grade) 참고) |
| `entries` | `object[]` | 옵션 줄 목록 |
| `entries[].grade` | `number` | 해당 옵션 줄 등급 |
| `entries[].text` | `string` | 옵션 문구. 예: `"공격력 +12%"` |
| `description` | `string` | 등급 표기. 예: `"잠재능력 : 레전드리"` |

### 등급 코드 (`grade`)

`potentialGrade` 필터와 잠재 `grade`에서 쓰이는 코드 (관측 기반 추정).

| 코드 | 등급 |
| :---: | --- |
| `1` | 레어 |
| `2` | 에픽 |
| `3` | 유니크 |
| `4` | 레전드리 |

---

## 응답 예시 (item 1건)

```json
{
  "items": [
    {
      "_id": "wL5nlhSYA1hQmYGYzj1UpfBrC58H9fH3SgAOjKFq3mA:1",
      "tradeSn": "wL5nlhSYA1hQmYGYzj1UpfBrC58H9fH3SgAOjKFq3mA",
      "subIdx": 1,
      "itemName": "아케인셰이드 가즈",
      "currentUpgradeCount": 9,
      "starforce": 0,
      "quantity": 1,
      "price": "349999999",
      "pricePerItem": "349999999",
      "endDate": "2026-07-09T12:24:11.920Z",
      "status": "ON_SALE",
      "toolTip": {
        "starforce": 0,
        "starforceMax": 30,
        "itemName": "아케인셰이드 가즈",
        "categories": ["무기", "두손", "아대"],
        "reqJob": "도적",
        "reqLevel": 200,
        "attackSpeed": "6단계",
        "stat": {
          "str": 36, "dex": 100, "luk": 163, "all": 6,
          "pad": 284, "dam": 5, "bdr": 30, "imdr": 20
        },
        "setEffects": ["아케인셰이드 세트(도적)"],
        "upgradeInfo": {
          "starForce": {
            "current": 0, "max": 30, "canUpgrade": true,
            "description": "스타포스 : 없음 (최대 30성)"
          },
          "scroll": {
            "current": 9, "remaining": 0, "failure": 0, "max": 9,
            "canUpgrade": true,
            "description": "주문서 강화 9회 (잔여 0회, 복구 가능 0회)"
          },
          "exOption": {
            "sum": 23, "canUpgrade": true,
            "entries": [
              { "grade": 5, "text": "데미지  +5%" },
              { "grade": 6, "text": "올스탯  +6%" },
              { "grade": 6, "text": "STR, LUK  +36" },
              { "grade": 6, "text": "공격력  +72" }
            ],
            "description": "추가옵션"
          },
          "potential": {
            "grade": 4,
            "entries": [
              { "grade": 4, "text": "공격력 +12%" },
              { "grade": 4, "text": "몬스터 방어율 무시 +40%" },
              { "grade": 3, "text": "DEX +9%" }
            ],
            "description": "잠재능력 : 레전드리"
          },
          "additionalPotential": {
            "grade": 2,
            "entries": [
              { "grade": 2, "text": "공격력 +6%" },
              { "grade": 1, "text": "크리티컬 확률 +4%" },
              { "grade": 1, "text": "공격력 +3%" }
            ],
            "description": "에디셔널 잠재능력 : 에픽"
          }
        }
      }
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 395,
  "totalPages": 20,
  "hasNext": true,
  "searchKey": "5bbf4bbc-ab0b-4678-a142-b96a3f3390ac"
}
```

> 위 예시는 지면을 위해 일부 필드를 생략했다. 전체 필드는 위 스키마 표 참고.

---

## 페이지네이션

- 첫 요청은 `page: 1`.
- 응답 `hasNext`가 `true`인 동안 `page`를 증가시키며 반복.
- 전체 페이지 수는 `totalPages` (`= ceil(total / limit)`).
- `limit`은 페이지당 **최대 60**. (실측 2026-07-08: `limit=60`은 `201`, `100` 이상은 `429`)
- ⚠️ 이 `POST`는 **일일 검색 횟수를 1회 소진**한다. 2페이지 이후는 [`GET` 재조회](./아이템-검색-페이지네이션.md)로 넘기면 **횟수를 소진하지 않는다**. 자세한 건 페이지네이션 문서의 "검색 횟수 절약" 참고.
