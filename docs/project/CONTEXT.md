# Golgolion

시세 계산, 수집 상태, 보존 정책 및 필수 검증 시나리오의 상세 원본은
[시세 도메인 규칙](../domains/market-price.md)이다.

## Goal

던전앤파이터 아이템 골고라이언의 시세를 보여주는  
소규모 포트폴리오 웹사이트를 만든다.

## Fixed

- Next.js 사용
- TypeScript 사용
- App Router 사용
- npm 사용
- 웹 프로젝트
- 1인 개발
- 포트폴리오 목적
- 사용자 도메인은 유료 사용 가능
- 프런트엔드, 백엔드, 데이터 저장소는 무료 티어 사용
- Vercel Hobby에 Next.js 프런트엔드와 공개 API 배포
- Supabase Free의 PostgreSQL, Cron, Edge Function으로 데이터 저장과 10분 수집 처리
- 네오플 오픈 API의 전체 서버 통합 경매장 체결 데이터 사용
- MVP 조회 대상은 `+10 장비 증폭권[골고라이언]`
- 향후 `골고라이언 +1`부터 `골고라이언 +15`까지 확장 가능한 데이터 구조
- 체결 데이터를 10분마다 수집하고 공개 화면은 1시간 단위로 갱신
- 한국 시간 기준 일봉 OHLC와 도메인 상태는 시세 도메인 규칙을 따름
- 거래 건수와 거래량을 함께 저장
- 화면에는 거래된 아이템 개수를 거래량으로 표시하고 거래대금은 표시하지 않음
- MVP 차트의 초기 표시 범위는 최근 30일
- 고도화 시 차트의 기간 선택을 먼저 확장하고 캔들 단위 선택을 이후 추가
- Tailwind CSS 사용
- TradingView Lightweight Charts 사용
- Vitest로 OHLC, 중복 제거, 상태 판정 단위 테스트
- 네오플 API 응답 fixture를 이용한 수집 테스트
- Playwright로 차트 로딩과 기간 선택 핵심 흐름 테스트
- 데스크톱과 모바일 레이아웃 지원
- 태블릿 전용 레이아웃은 제공하지 않음
- 메인 화면 푸터에서 접근 가능한 `/open-source-licenses` 페이지에 Lightweight Charts의 NOTICE와 TradingView 링크 표시
- MVP와 이후 버전 모두 로그인, 즐겨찾기, 아이템 검색 기능을 제공하지 않음
- 가격은 천 단위 구분자를 적용한 `<가격> 골드`, 거래량은 `<수량>개` 형식으로 표시

## Pending

- 장기 차트의 캔들 단위 및 조회 범위
- 네오플 API 응답 필드와 중복 제거 기준의 실제 키 검증

## Current phase

Application foundation complete

GOL-003 data collection pipeline is ready to start.

## Constraints and risks

- 네오플 경매장 시세 API는 최근 거래 최대 100건 또는 최대 1개월만 제공하므로 장기 차트를 위해 자체 수집과 저장이 필요하다.
- 10분 사이에 거래가 100건을 초과하면 일부 체결을 놓칠 수 있다.
- API 수집 실패와 데이터 누락을 정상적인 무거래 구간과 구분해야 한다.
- 네오플 오픈 API 이용 사실을 서비스에 표시해야 한다.
- Lightweight Charts의 NOTICE와 TradingView 링크가 있는 오픈소스 라이선스 페이지를 사용자가 접근할 수 있어야 한다.
- API 키는 실제 연동 검증이 필요한 시점에 요청한다.
- Vercel Hobby의 Cron은 하루 한 번으로 제한되므로 10분 수집에는 사용하지 않는다.
- Supabase Free의 데이터베이스 용량은 500MB이며, 활동량이 적으면 프로젝트가 일시 정지될 수 있다.

## Future direction

- 업비트가 제공하는 수준을 참고하여 기간 선택을 확장한 뒤 초, 분, 일, 주, 월, 연 단위 캔들을 단계적으로 추가한다.
- MVP에서는 일봉과 최근 30일 조회만 제공한다.
