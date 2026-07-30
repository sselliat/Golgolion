# import와 타입 사용

[코드 컨벤션 목차](../CODE_CONVENTIONS.md)에서 이 문서의 적용 대상을 확인한다.

## import 경로

- `@/*`를 `src/*`에 매핑한다.
- 같은 디렉터리의 모듈은 상대 경로로 가져온다.
- 디렉터리를 넘어가는 프로젝트 내부 모듈은 `@/` 별칭으로 가져온다.
- `../`를 연속해서 사용하는 상위 경로 import는 사용하지 않는다.

```ts
import { PriceChart } from './PriceChart';
import { calculateCurrentPrice } from '@/features/market-price/lib/calculate-current-price';
```

## import 순서

import는 다음 그룹 순서로 작성하고 그룹 사이에 빈 줄 하나를 둔다.

1. React, Next.js 및 외부 패키지
2. `@/`로 시작하는 프로젝트 내부 모듈
3. 상대 경로 모듈
4. CSS 등 부수 효과 import

```ts
import { useEffect } from 'react';
import { createChart } from 'lightweight-charts';

import { formatGold } from '@/lib/format-gold';

import { ChartLegend } from './ChartLegend';

import './price-chart.css';
```

- 각 그룹 내부의 정렬은 자동화 도구에 맡긴다.
- 순서에 의미가 있는 부수 효과 import는 추가하지 않는 것을 기본으로 한다.
- 순서에 의미가 있는 부수 효과 import가 불가피하면 인접 주석으로 이유를 설명한다.

## 타입 전용 import와 export

- 타입만 가져올 때는 `import type`을 사용한다.
- 같은 모듈에서 값과 타입을 함께 가져올 때는 인라인 `type`을 사용한다.
- 타입만 다시 내보낼 때는 `export type`을 사용한다.

```ts
import type { DailyCandle } from '@/features/market-price/types';

import { calculateCurrentPrice, type CurrentPriceOptions } from '@/features/market-price';

export type { MarketPriceResponse } from './types';
```

## `interface`와 `type`

- 객체 형태와 컴포넌트 Props는 `interface`로 정의한다.
- 유니온, 교차, 튜플, 함수 타입, 매핑 타입 및 조건부 타입은 `type`으로 정의한다.
- 타입과 인터페이스는 `PascalCase`를 사용하고 `I` 접두사를 붙이지 않는다.

```ts
interface PriceChartProps {
  candles: readonly DailyCandle[];
}

interface TaskResponse {
  taskId: string;
  status: TaskStatus;
}

type TaskStatus = 'queued' | 'running' | 'complete';
type PricePoint = readonly [timestamp: number, price: number];
```

## 타입 추론과 명시

- 지역 변수와 명확한 내부 계산 결과는 타입 추론을 사용한다.
- 함수 매개변수에는 타입을 명시한다.
- 외부로 export하는 일반 함수와 API·데이터베이스 경계 함수에는 반환 타입을 명시한다.
- React 컴포넌트의 반환 타입은 별도로 명시하지 않고 추론한다.
- `catch` 값과 외부 입력처럼 확인되지 않은 값은 `unknown`에서 시작한다.

```ts
export function calculateCurrentPrice(options: CurrentPriceOptions): CurrentPriceResult {
  const sampleSize = options.prices.length;
  // sampleSize는 number로 추론된다.
}
```

## `any`와 외부 데이터

- 명시적 또는 암시적 `any`를 사용하지 않는다.
- 타입을 모르는 값은 `unknown`을 사용한다.
- API 응답, 환경변수 가공 결과 등 외부 입력은 런타임 검증 후 도메인 타입으로 변환한다.
- 타입이 부정확한 외부 라이브러리 때문에 `any`가 불가피하면 가장 좁은 범위에서 사용하고 인접 주석으로 이유를 설명한다.

## 타입 단언

- 타입 가드, 조건 검사 및 런타임 검증을 타입 단언보다 우선한다.
- `as`와 non-null 단언 연산자 `!`의 사용을 최소화한다.
- `as` 또는 `!`를 사용해야 할 경우 인접 주석으로 타입 단언이 필요한 이유를 설명한다.
- 객체가 지정 타입을 만족하는지 검사하면서 구체적인 추론을 유지할 때는 `satisfies`를 사용한다.
- `as unknown as SomeType` 형태의 이중 단언은 사용하지 않는다.

## 열거 가능한 값

- `enum`은 사용하지 않는다.
- 열거 가능한 상태는 문자열 또는 숫자 리터럴 유니온으로 표현한다.
- 런타임 값 객체가 함께 필요하면 `as const`와 `satisfies`를 사용한다.

```ts
type TaskStatus = 'queued' | 'running' | 'complete' | 'failed';

const TASK_STATUS_LABELS = {
  queued: '대기',
  running: '실행 중',
  complete: '완료',
  failed: '실패',
} as const satisfies Record<TaskStatus, string>;
```

## 엄격성과 불변 입력

- TypeScript `strict` 모드를 전제로 작성한다.
- 함수가 변경하지 않는 배열과 객체 입력에는 필요한 범위에서 `readonly`를 사용한다.
- `null`과 `undefined` 가능성을 타입에 명시하고 검사 없이 제거하지 않는다.
