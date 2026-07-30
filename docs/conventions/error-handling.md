# 오류 처리

[코드 컨벤션 목차](../CODE_CONVENTIONS.md)에서 이 문서의 적용 대상을 확인한다.

## 오류 분류와 전달

오류와 상태를 다음과 같이 구분한다.

1. 정상적인 도메인 상태는 데이터로 반환한다.
2. 예상 가능한 운영 실패는 식별 가능한 실패 값으로 반환한다.
3. 예상하지 못한 결함은 `Error`를 throw한다.

모든 내부 함수에 결과 타입을 강제하지 않는다. 외부 시스템, API 및 작업 실행 경계에서 예상 가능한 실패를 판별 가능한 유니온으로 변환한다.

```ts
type FetchMarketPriceResult =
  | { ok: true; data: MarketPrice }
  | { ok: false; error: MarketPriceFailure };

type MarketPriceFailure =
  | { code: typeof MARKET_PRICE_ERROR_CODE.UPSTREAM_UNAVAILABLE }
  | { code: typeof MARKET_PRICE_ERROR_CODE.INVALID_UPSTREAM_RESPONSE };
```

## 도메인 상태와 오류

- 정상적으로 발생할 수 있는 도메인 상태는 예외 대신 판별 가능한 데이터로 처리한다.
- 사용자가 존재하지 않는 리소스 경로를 요청한 경우에는 404로 처리한다.
- 프로그램 불변식 위반이나 처리할 수 없는 응답 형식은 오류로 처리한다.
- 도메인 상태는 `error.tsx`가 아니라 정상 UI 안에서 표현한다.

기능별 상태와 전이 규칙은 해당 도메인 문서를 따른다. 시세 기능에는
[시세 도메인 규칙](../domains/market-price.md)을 적용한다.

## 예외 생성

- 문자열이나 일반 객체를 throw하지 않고 항상 `Error` 인스턴스를 throw한다.
- 원본 오류를 감쌀 때는 `cause`로 보존한다.
- catch에서 오류 종류에 따라 분기해야 할 때만 사용자 정의 `Error` 클래스를 사용한다.
- 오류 메시지에는 실패한 작업과 대상 정보를 포함하되 비밀값은 포함하지 않는다.
- 예상 가능한 실패를 사용자 정의 예외 클래스로 표현하지 않고 실패 값으로 반환한다.

```ts
throw new Error(MARKET_PRICE_INTERNAL_ERROR_MESSAGE.FETCH_TRADES_FAILED, {
  cause,
});
```

## catch 처리

- catch 값은 `unknown`으로 취급하고 타입을 확인한 후 사용한다.
- 복구, 실패 값 변환 또는 유용한 문맥 추가가 가능한 위치에서만 catch한다.
- 빈 catch 블록을 사용하지 않는다.
- 오류를 기록만 하고 성공한 것처럼 실행을 계속하지 않는다.
- 다시 throw할 때는 원본 오류를 `cause`로 보존한다.
- 동일한 오류를 여러 계층에서 중복 기록하지 않는다.
- 동일한 오류를 그대로 다시 던질 뿐이라면 catch하지 않는다.

```ts
try {
  return await fetchCompletedTrades();
} catch (cause: unknown) {
  throw new Error(MARKET_PRICE_INTERNAL_ERROR_MESSAGE.COLLECT_TRADES_FAILED, {
    cause,
  });
}
```

## Next.js 화면 오류

- 예상 가능한 실패와 도메인 상태는 컴포넌트에서 명시적으로 렌더링한다.
- 존재하지 않는 라우트 리소스는 `notFound()`와 `not-found.tsx`로 처리한다.
- 예상하지 못한 렌더링 또는 데이터 조회 예외는 가장 가까운 라우트의 `error.tsx`에서 처리한다.
- 루트 레이아웃 수준의 치명적 오류는 `global-error.tsx`에서 처리한다.
- 오류 경계에는 사용자가 실행할 수 있는 안전한 재시도 또는 이동 수단을 제공한다.
- 렌더링 중 자식 컴포넌트 오류를 잡기 위해 `try/catch`를 사용하지 않는다.
- `notFound()`와 `redirect()`를 광범위한 `try/catch`로 감싸서 프레임워크의 제어 흐름을 가로채지 않는다.

## Route Handler 오류 응답

Route Handler는 안정적인 기계 판독용 코드와 안전한 사용자 메시지를 같은 형식으로 반환한다.

```json
{
  "error": {
    "code": "UPSTREAM_UNAVAILABLE",
    "message": "시세 데이터를 일시적으로 불러올 수 없습니다."
  }
}
```

- 입력 오류는 HTTP `400`을 사용한다.
- 존재하지 않는 리소스는 HTTP `404`를 사용한다.
- 외부 서비스의 잘못된 응답은 HTTP `502`를 사용한다.
- 일시적인 서비스 불가는 HTTP `503`을 사용한다.
- 분류하지 못한 내부 오류는 HTTP `500`을 사용한다.
- 스택 트레이스, API 키, 데이터베이스 정보 및 외부 API 원문 오류는 응답에 포함하지 않는다.
- 내부 진단용 오류와 사용자에게 공개할 메시지를 분리한다.

## 오류 코드와 메시지 상수

- 오류 코드와 사용자용 오류 메시지는 코드에 문자열로 흩어 놓지 않고 constants 모듈에서 관리한다.
- 상수는 해당 오류를 소유한 기능 가까이에 둔다.
- 여러 기능에서 실제로 공유하는 오류만 공용 constants 모듈로 올린다.
- 오류 코드와 메시지는 `as const` 객체로 정의하고 코드에서 상수를 참조한다.
- 오류 코드 타입은 상수 객체에서 파생하여 코드와 타입의 불일치를 방지한다.

```ts
export const MARKET_PRICE_ERROR_CODE = {
  UPSTREAM_UNAVAILABLE: 'UPSTREAM_UNAVAILABLE',
  INVALID_UPSTREAM_RESPONSE: 'INVALID_UPSTREAM_RESPONSE',
} as const;

export type MarketPriceErrorCode =
  (typeof MARKET_PRICE_ERROR_CODE)[keyof typeof MARKET_PRICE_ERROR_CODE];

export const MARKET_PRICE_ERROR_MESSAGE = {
  [MARKET_PRICE_ERROR_CODE.UPSTREAM_UNAVAILABLE]:
    '시세 데이터를 일시적으로 불러올 수 없습니다.',
  [MARKET_PRICE_ERROR_CODE.INVALID_UPSTREAM_RESPONSE]:
    '시세 데이터 형식을 확인할 수 없습니다.',
} as const satisfies Record<MarketPriceErrorCode, string>;

export const MARKET_PRICE_INTERNAL_ERROR_MESSAGE = {
  FETCH_TRADES_FAILED: '네오플 체결 데이터 조회에 실패했습니다.',
  COLLECT_TRADES_FAILED: '체결 데이터 수집에 실패했습니다.',
} as const;
```

## 재시도와 비동기 오류

- Promise는 의도적으로 반환하거나 `await`하여 처리되지 않은 Promise를 남기지 않는다.
- 네트워크 단절, 타임아웃, HTTP `429` 및 일부 `5xx`처럼 일시적인 실패만 재시도한다.
- 재시도 횟수를 제한하고 지수 백오프를 사용한다.
- 입력 검증 실패, 인증 실패 및 코드 결함은 재시도하지 않는다.
- 쓰기 작업은 멱등성이 보장될 때만 자동으로 재시도한다.
- 여러 독립 작업이 모두 성공해야 하면 `Promise.all`을 사용한다.
- 부분 성공을 실제로 처리할 수 있을 때만 `Promise.allSettled`를 사용한다.
- 구체적인 재시도 횟수와 시간은 외부 API 계약을 확인한 후 정한다.

## 로깅과 사용자 메시지

- 오류는 처리 경계에서 한 번만 기록한다.
- 작업명, 데이터 대상, 상태 코드 및 시각 등 진단 가능한 구조적 문맥을 포함한다.
- API 키, 인증 헤더, 쿠키, 전체 환경변수 및 민감한 원문 응답은 기록하지 않는다.
- 사용자 메시지는 기술 세부사항 대신 현재 상태와 가능한 행동을 안내한다.
- 실제로 안전하게 재시도할 수 있을 때만 사용자에게 재시도를 안내한다.
- 특정 로깅 서비스나 라이브러리는 이 규칙에서 강제하지 않는다.
