# GOL-001 네오플 API 계약 검증

검증 기준일: 2026-07-30

## 상태

공식 문서 검토와 제한된 실제 응답 검증을 완료했다.

- 수집 시각: 2026-07-30 13:55:13 UTC (2026-07-30 22:55:13 KST)
- 계약 테스트: 5개 통과
- 비식별 fixture: 6개

## 대상

- 아이템: `+10 장비 증폭권[골고라이언]`
- API 기준 URL: `https://api.neople.co.kr`
- 공식 문서: <https://developers.neople.co.kr/contents/apiDocs/df>
- 공식 상품 안내: <https://df.nexon.com/pg/tropicalpkg>

공식 상품 안내에서 2026년에도 `+7 ~ +12 장비 증폭권[골고라이언]`이
제공되고, 해당 아이템이 2026-12-24 06:00 삭제 예정임을 확인했다. 따라서
`+10` 변형의 현재 존재 가능성을 공식 자료로 확인했다.

실제 아이템 검색 API의 정확 일치 결과는 한 건이었다.

| 항목 | 값 |
| --- | --- |
| `itemId` | `4a737b2ae337a57260ca4663ce6a9bb0` |
| `itemName` | `+10 장비 증폭권[골고라이언]` |
| `itemRarity` | `유니크` |
| `itemType` | `스태커블` |
| `itemTypeDetail` | `기타` |
| `itemAvailableLevel` | `1` |
| `fame` | `0` |

## 공식 문서로 확인한 계약

### 아이템 검색

- 엔드포인트: `GET /df/items`
- `itemName` 또는 `hashtag` 중 하나가 필수다.
- `wordType`은 `match`, `front`, `full`을 지원하며 기본값은 `match`다.
- `limit` 기본값은 10, 최댓값은 30이다.
- 현재 인게임에서 획득 가능한 아이템만 검색된다.

### 경매장 등록 매물

- 검색 엔드포인트: `GET /df/auction`
- 단건 조회 엔드포인트: `GET /df/auction/:auctionNo`
- `itemId`, `itemName`, `itemIds` 중 하나가 필수다.
- `limit` 기본값은 10, 최댓값은 400이다.
- `sort`는 `unitPrice`, `reinforce`, `auctionNo`의 `asc`/`desc`를 지원한다.
- `sort`를 생략하면 `auctionNo`만 오름차순으로 정렬된다.

### 경매장 체결 내역

- 엔드포인트: `GET /df/auction-sold`
- `itemId`, `itemName`, `itemIds` 중 하나가 필수다.
- `limit` 기본값은 10, 최댓값은 100이다.
- 최근 100건 또는 최대 1개월 전까지의 거래 내역만 제공한다.
- 레벨·레어리티 등의 상세 조건 검색은 지원하지 않는다.
- 공식 문서에 페이지네이션 또는 정렬 요청변수는 기재되어 있지 않다.

모든 공식 요청 예시는 `apikey` 쿼리 파라미터를 사용한다.

## 실제 응답 관찰 결과

아래 결과는 2026-07-30의 제한된 실제 호출 표본에 대한 관찰이다. 공식 문서가
보장하지 않는 nullable 여부나 정렬은 영구 계약으로 단정하지 않는다.

### 공통 응답 구조

아이템 검색, 등록 매물 검색, 체결 내역 검색의 최상위 객체에는 `rows` 배열만
존재했다. 체결 내역 응답에는 `next`와 같은 페이지네이션 필드가 없었다.

### 아이템 검색 및 상세

아이템 검색 행에서 관찰한 필드는 다음과 같다.

| 필드 | 관찰 자료형 | 표본 null |
| --- | --- | --- |
| `itemId` | string | 아니요 |
| `itemName` | string | 아니요 |
| `itemRarity` | string | 아니요 |
| `itemTypeId` | string | 아니요 |
| `itemType` | string | 아니요 |
| `itemTypeDetailId` | string | 아니요 |
| `itemTypeDetail` | string | 아니요 |
| `itemAvailableLevel` | number | 아니요 |
| `fame` | number | 아니요 |

상세 응답에는 위 필드와 `itemExplain`, `itemExplainDetail`, `itemFlavorText`,
`setItemId`, `setItemName`이 있었다. 대상 아이템의 `setItemId`와
`setItemName`은 `null`이었다.

### 등록 매물

기본 정렬 호출에서 44건, 단가 오름차순 호출에서 45건을 관찰했다. 호출 사이에
경매장 상태가 변할 수 있으므로 두 응답의 행 수 차이는 정상이다.

| 필드 | 관찰 자료형 | 표본 null |
| --- | --- | --- |
| `auctionNo` | number | 아니요 |
| `regDate`, `expireDate` | string | 아니요 |
| 아이템 메타데이터 필드 | string/number | 아니요 |
| `refine`, `reinforce`, `fame` | number | 아니요 |
| `amplificationName` | null | 전체 |
| `count`, `regCount` | number | 아니요 |
| `price`, `currentPrice`, `unitPrice`, `averagePrice` | number | 아니요 |

관찰 결과:

- 기본 응답의 `auctionNo`는 오름차순이었다.
- `sort=unitPrice:asc` 응답의 `unitPrice`는 오름차순이었다.
- 모든 행에서 `currentPrice === unitPrice * count`였다.
- 모든 행에서 `regCount >= count`였다.
- `auctionNo`는 표본에서 중복이 없고 JavaScript safe integer 범위였다.
- 날짜 형식은 `YYYY-MM-DD HH:mm:ss`이며 시간대 오프셋은 포함하지 않았다.

### 체결 내역

`limit=100` 호출은 정확히 100건을 반환했다. 최신 체결은
`2026-07-30 22:50:19`, 가장 오래된 체결은 `2026-07-30 18:26:31`로,
약 4시간 24분 분량만으로 100건 한도를 채웠다.

| 필드 | 관찰 자료형 | 표본 null |
| --- | --- | --- |
| `soldDate` | string | 아니요 |
| 아이템 메타데이터 필드 | string/number | 아니요 |
| `refine`, `reinforce`, `fame` | number | 아니요 |
| `amplificationName` | null | 전체 |
| `count`, `price`, `unitPrice` | number | 아니요 |

관찰 결과:

- `soldDate`는 내림차순이었다.
- 모든 행에서 `price === unitPrice * count`였다.
- `soldDate`가 같은 행은 3쌍 있었지만 전체 필드가 같은 중복 행은 없었다.
- `auctionNo`, 거래 ID 또는 다른 체결 고유 식별자는 제공되지 않았다.
- `soldDate + itemId + unitPrice + count` 복합 키는 이번 표본에서 유일했다.
- 날짜 형식은 `YYYY-MM-DD HH:mm:ss`이며 시간대 오프셋은 포함하지 않았다.

수집 시각 22:55 KST와 최신 등록·체결 시각이 각각 22:52, 22:50인 점을 보면
날짜 값은 KST와 일치한다. 다만 응답 자체에 오프셋이 없고 공식 문서에도
시간대 보장이 없으므로 **KST로 관찰됨**으로만 기록한다.

## 중복 제거와 연속성 판정

체결 고유 ID가 없으므로 완전히 안전한 중복 제거 키를 확정할 수 없다.
`soldDate + itemId + unitPrice + count`를 잠정 fingerprint로 사용할 수 있지만,
동일 초에 동일 단가와 동일 수량으로 서로 다른 거래가 발생하면 충돌한다.
`price`는 표본에서 `unitPrice * count`로 파생되므로 키에 추가해도 충돌을
해결하지 못한다.

후속 수집기는 다음 한계를 명시적으로 다뤄야 한다.

- fingerprint가 같은 행을 무조건 하나로 합치면 실제 거래량을 누락할 수 있다.
- 동일 응답 안의 같은 fingerprint는 발생 횟수를 보존하는 multiset으로 다룬다.
- 이전 호출과 겹치는 구간의 비교 시 fingerprint별 발생 횟수를 함께 비교한다.
- 100건 응답에서 이전 경계와 연속성을 확인하지 못하면 해당 일봉을
  `incomplete`로 판정한다.
- 이번 표본도 100건 한도를 채웠으므로 페이지네이션 없이 더 오래된 거래를
  복원할 방법은 확인되지 않았다.

## 실행 방법

API 키를 채팅이나 명령행 인수에 붙이지 않는다. 다음 내용으로 저장소 루트에
Git에서 제외되는 `.env.local` 파일을 만든 뒤 실행할 수 있다.

```dotenv
NEOPLE_API_KEY=<발급받은 키>
```

```powershell
node --env-file=.env.local tools/neople/capture-contract-fixtures.mjs
node --test tests/contracts/neople-fixtures.test.mjs
```

키는 명령행 인수, URL 출력, fixture, 문서 또는 Git 커밋에 넣지 않는다.

수집 스크립트는 다음의 제한된 5회 호출만 수행한다.

1. 정확한 이름의 아이템 검색
2. 검색된 아이템 상세 조회
3. 등록 매물 기본 정렬 조회
4. 등록 매물 단가 오름차순 조회
5. 최근 체결 내역 100건 조회

## fixture 정책

- 위치: `docs/validation/neople/fixtures/`
- `manifest.json`에는 API 키를 제외한 요청 조건과 수집 시각을 기록한다.
- 응답에서 사용자·캐릭터·판매자·구매자 식별 가능성이 있는 필드는 값을
  `[REDACTED]`로 치환한다.
- `auctionNo`와 같은 경매 데이터 식별자는 중복 제거 검증에 필요하므로 유지한다.
- 원본 응답은 저장하지 않는다.

## 후속 판정

관찰된 응답 계약은 테스트의 필수 필드, 자료형, 정렬, 가격·수량 관계
assertion으로 고정한다. 표본에서 `null`이 나오지 않았다는 사실만으로 non-null
계약을 단정하지 않으며, 공식 보장과 표본 관찰을 구분한다.

## 남은 불확실성

- 동일 fingerprint의 서로 다른 체결을 구분하는 서버 측 식별자는 없다.
- 1개월 경계는 대상 아이템의 거래량이 많아 이번 제한 호출로 재현하지 못했다.
- 날짜가 KST라는 공식 보장은 찾지 못했다.
- 향후 API 필드 추가·nullable 변화 가능성은 정기 계약 검증으로 감지해야 한다.
