# 컴포넌트와 함수 작성 방식

[코드 컨벤션 목차](../CODE_CONVENTIONS.md)에서 이 문서의 적용 대상을 확인한다.

## 컴포넌트 선언과 export

- 파일 최상위 컴포넌트는 함수 선언식으로 작성한다.
- 컴포넌트의 props에는 명시적인 `<ComponentName>Props` 타입을 지정한다.
- `React.FC`는 사용하지 않는다.
- 프레임워크나 도구가 `default export`를 요구하는 경우에만 사용한다.
- `default export`가 강제되지 않는 컴포넌트와 함수는 named export를 사용한다.

```tsx
interface PriceChartProps {
  candles: DailyCandle[];
}

export function PriceChart({ candles }: PriceChartProps) {
  return candles.map((candle) => <div key={candle.date}>{candle.close}</div>);
}
```

Next.js 특수 파일처럼 `default export`가 요구되는 경우에는 해당 프레임워크 규칙을 따른다.

```tsx
// src/app/page.tsx
export default function Page() {
  return <main />;
}
```

## 서버 컴포넌트와 클라이언트 컴포넌트

- 서버 컴포넌트를 기본으로 사용한다.
- 상태, 이벤트 처리, Effect, 브라우저 전용 API 또는 커스텀 훅이 필요한 최소 범위에만 `'use client'`를 선언한다.
- 페이지 전체를 클라이언트 컴포넌트로 만들지 않고 상호작용이 필요한 하위 경계만 클라이언트 컴포넌트로 분리한다.
- 서버 컴포넌트에서 조회한 데이터는 직렬화 가능한 props로 클라이언트 컴포넌트에 전달한다.

```text
MarketPricePage        Server Component
├─ PriceSummary        Server Component
├─ MarketStatus        Server Component
└─ PriceChart          Client Component
```

## Props와 상태

- props는 컴포넌트 매개변수에서 구조 분해한다.
- props와 state를 직접 변경하지 않는다.
- props나 기존 state로 계산할 수 있는 값은 별도 state에 중복 저장하지 않는다.
- 컴포넌트 렌더링 중 외부 상태를 변경하거나 부수 효과를 실행하지 않는다.

## 컴포넌트 분리

- 파일마다 하나의 주된 export 컴포넌트를 둔다.
- 해당 파일에서만 사용하는 작은 보조 컴포넌트는 같은 파일에 둘 수 있다.
- 독립적인 책임, 재사용 가능성, 별도 테스트 필요성 또는 다른 서버·클라이언트 실행 경계를 가지면 별도 파일로 분리한다.
- 특정 줄 수만으로 컴포넌트 분리를 강제하지 않는다.
- `page.tsx`와 `layout.tsx`는 컴포넌트 조합과 데이터 전달에 집중한다.
- 복잡한 도메인 계산은 `features/*/lib`의 일반 함수로 분리한다.

## 일반 함수

- 파일 최상위 함수는 함수 선언식으로 작성한다.
- 인라인 콜백과 짧은 지역 함수에는 화살표 함수를 사용한다.
- 가능한 함수는 같은 입력에 같은 결과를 반환하는 순수 함수로 작성한다.
- 데이터 조회, 저장, 로그 같은 부수 효과는 경계 함수로 분리한다.
- 함수 하나가 하나의 명확한 책임을 갖도록 작성한다.
- 매개변수가 3개 이상이거나 같은 타입의 인수가 이어져 의미가 불명확하면 객체 매개변수를 사용한다.

```ts
calculateCurrentPrice({
  prices,
  sampleSize: 5,
  allowedDeviation: 0.1,
});
```

## 메모이제이션

- `memo`, `useMemo`, `useCallback`을 습관적으로 사용하지 않는다.
- 성능 측정으로 병목이 확인되었거나 참조 동일성이 실제 동작에 필요한 경우에만 수동 메모이제이션을 사용한다.
- 코드는 수동 메모이제이션 없이도 올바르게 동작해야 한다.
