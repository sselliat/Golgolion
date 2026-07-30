# 코드 컨벤션

이 문서는 Golgolion 저장소의 공통 필수 규칙과 세부 컨벤션 문서의 적용 대상을
정의한다. 코드를 작성하거나 수정할 때 이 문서를 먼저 읽고, 작업 범위에 해당하는
세부 문서만 추가로 읽는다.

## 공통 필수 규칙

- 테스트와 fixture를 제외한 구현 파일은 `src/` 아래에 둔다.
- React 컴포넌트와 컴포넌트 파일은 `PascalCase`, 일반 TypeScript 파일과 사용자
  정의 폴더는 `kebab-case`를 사용한다.
- 함수와 변수는 `camelCase`, 전역 불변 설정 상수는 `UPPER_SNAKE_CASE`를 사용한다.
- 타입과 인터페이스는 `PascalCase`를 사용하고 `I` 접두사를 붙이지 않는다.
- 프레임워크나 도구가 강제하지 않는 한 `default export`를 사용하지 않는다.
- 서버 컴포넌트를 기본으로 사용하고 필요한 최소 범위에만 `'use client'`를 선언한다.
- TypeScript `strict` 모드를 전제로 하며 `any`와 `enum`을 사용하지 않는다.
- 오류 코드와 사용자용·내부용 오류 메시지는 해당 기능의 constants 모듈에서
  상수로 관리한다.
- 테스트 케이스명은 한글로 작성한다.
- 일반적인 로직에는 주석을 달지 않는다. 복잡한 비즈니스 규칙, 도메인 경계,
  외부 제약 또는 직관적이지 않은 선택의 이유에만 한글 주석을 작성한다.
- 불가피한 타입 단언, non-null 단언, `any`, 검사 억제에는 가장 좁은 범위에
  한글로 사유를 작성한다.
- ESLint warning은 CI에 표시하되 CI 실패 조건으로 사용하지 않는다.

세부 조건과 예외는 아래 문서가 우선한다.

## 작업별 문서 선택

| 작업 범위 | 읽을 문서 |
| --- | --- |
| 파일·폴더 생성, 이동, 이름 변경 | [명명법과 파일 구조](conventions/project-structure.md) |
| React 컴포넌트, 훅, 일반 함수 | [컴포넌트와 함수](conventions/react-and-functions.md) |
| TypeScript 타입, import, export | [TypeScript](conventions/typescript.md) |
| 오류, API, 외부 시스템, 수집, 재시도, 로깅 | [오류 처리](conventions/error-handling.md) |
| 테스트, fixture, mock, coverage | [테스트](conventions/testing.md) |
| 복잡한 주석, JSDoc, TODO, 검사 억제 | [주석](conventions/comments.md) |
| 시세 계산, 일봉, 수집, 데이터 상태 | [시세 도메인](domains/market-price.md) |
| 커밋, 브랜치, 이슈, Pull Request, merge | [기여 규칙](CONTRIBUTING.md) |
| ESLint, Prettier, TypeScript 설정, CI | [품질 검사](engineering/quality-gates.md) |

하나의 작업이 여러 범위에 걸치면 해당 문서를 모두 읽는다. 관련 없는 세부 문서는
읽지 않는다.
