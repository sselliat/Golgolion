# 명명법과 파일 구조

[코드 컨벤션 목차](../CODE_CONVENTIONS.md)에서 이 문서의 적용 대상을 확인한다.

## 파일 구조

Next.js App Router를 중심으로 공용 코드는 역할별로, 도메인 코드는 기능별로 구성하는 혼합 구조를 사용한다.

```text
src/
├─ app/
│  ├─ api/
│  ├─ open-source-licenses/
│  ├─ layout.tsx
│  └─ page.tsx
├─ components/
│  └─ ui/
├─ features/
│  └─ market-price/
│     ├─ components/
│     ├─ lib/
│     ├─ types.ts
│     └─ index.ts
├─ lib/
└─ types/
tests/
├─ fixtures/
└─ e2e/
supabase/
├─ config.toml
├─ migrations/
└─ functions/
```

- 테스트와 fixture를 제외한 구현 파일은 `src/` 아래에 둔다.
- 여러 기능에서 사용하는 코드는 `src/components`, `src/lib`, `src/types`처럼 역할별 공용 디렉터리에 둔다.
- 특정 도메인에 속한 코드는 `src/features/<feature-name>` 아래에 기능별로 모은다.
- App Router의 라우트와 프레임워크 특수 파일은 `src/app` 아래에 둔다.
- `supabase/`는 Supabase CLI가 경로를 강제하는 도구 전용 예외다. CLI 설정,
  데이터베이스 마이그레이션 및 Edge Function은 각각 `supabase/config.toml`,
  `supabase/migrations/`, `supabase/functions/`에 둔다.
- `supabase/.temp/`와 `supabase/.branches/` 같은 로컬 생성물은 추적하지 않는다.

## 명명 규칙

- React 컴포넌트와 컴포넌트 파일은 `PascalCase`를 사용한다.
  - 예: `PriceChart`, `PriceChart.tsx`, `MarketStatusBadge.tsx`
- 일반 TypeScript 파일은 `kebab-case`를 사용한다.
  - 예: `calculate-current-price.ts`, `market-price.types.ts`
- Next.js가 지정한 특수 파일명은 프레임워크 규칙을 우선한다.
  - 예: `page.tsx`, `layout.tsx`, `route.ts`, `error.tsx`
- 함수와 변수는 `camelCase`를 사용한다.
  - 예: `calculateCurrentPrice`, `latestTrades`
- 전역 불변 설정 상수는 `UPPER_SNAKE_CASE`를 사용한다.
  - 예: `RAW_TRADE_RETENTION_DAYS`
- 타입과 인터페이스는 `PascalCase`를 사용하고 `I` 접두사를 붙이지 않는다.
  - 예: `DailyCandle`, `MarketPriceResponse`, `TradeRepository`
- React 훅은 `use` 접두사와 `camelCase`를 사용한다.
  - 예: `useMarketPrice`
- 단위 테스트 파일은 대상 파일명에 `.test`를 붙인다.
  - 예: `calculate-current-price.test.ts`
- Playwright E2E 테스트 파일은 대상 흐름의 파일명에 `.spec`을 붙인다.
  - 예: `market-price.spec.ts`
- 사용자 정의 폴더와 URL 경로는 소문자 `kebab-case`를 사용한다.
  - 예: `market-price/`, `open-source-licenses/`
- Next.js가 지정한 특수 폴더 문법은 프레임워크 규칙을 우선한다.
  - 예: `[itemId]`, `(marketing)`, `_components`
- 컴포넌트 전용 폴더가 필요하면 폴더는 `kebab-case`, 컴포넌트 파일은 `PascalCase`로 구분한다.
  - 예: `components/price-chart/PriceChart.tsx`
- 배럴 파일은 기능의 공개 진입점인 `index.ts`에만 제한적으로 사용한다.
