# 품질 검사

[코드 컨벤션 목차](../CODE_CONVENTIONS.md)에서 이 문서의 적용 대상을 확인한다.

## 적용 상태

이 문서는 프로젝트 품질 검사의 적용 상태와 목표를 정의한다. GOL-002에서 로컬
검사 명령과 설정을 활성화했으며, 저장소 권한이 필요한 GitHub 설정은 아직 적용하지 않았다.

| 항목 | 현재 상태 | 활성화 시점 |
| --- | --- | --- |
| Markdown과 Prettier | 로컬 script 적용 | GOL-002 |
| ESLint, TypeScript, Vitest | 로컬 script 적용 | GOL-002 |
| Playwright와 Next.js build 검사 | 로컬 script 적용 | GOL-002 |
| GitHub Actions와 merge gate | 미적용 | 저장소 설정 승인 후 |
| coverage 명령 | 로컬 script 적용 | GOL-002 |
| coverage threshold | 수치 미확정 | GOL-003 도메인 구현 측정 후 |

설정 파일과 실행 명령이 저장소에 추가되고 검증된 항목만 현재 적용 중인 검사로
간주한다. 구현 상태가 바뀌면 이 표를 같은 변경에서 갱신한다.

## 도구별 책임

- ESLint는 코드 오류, React·Next.js 규칙 및 타입 안전성을 검사한다.
- TypeScript는 정적 타입을 검사한다.
- Prettier는 공백, 줄바꿈, 따옴표 등 코드 서식을 처리한다.
- Vitest와 Playwright는 코드 동작을 검증한다.
- markdownlint는 Markdown 구조를 검사한다.
- 링크 검사기는 문서 링크의 유효성을 확인한다.
- GitHub Actions를 모든 자동 검사의 최종 실행 환경으로 사용한다.
- ESLint에 Prettier와 겹치는 서식 규칙을 추가하지 않는다.

## ESLint

- `eslint.config.mjs` flat config를 사용한다.
- `eslint-config-next/core-web-vitals`를 적용한다.
- `eslint-config-next/typescript`를 적용한다.
- `typescript-eslint`의 `recommended-type-checked`를 적용한다.
- 전체 `strict-type-checked` preset은 초기에는 적용하지 않고 필요한 엄격 규칙만 추가한다.
- `eslint-config-prettier`로 Prettier와 충돌하는 서식 규칙을 비활성화한다.
- `next lint`가 아니라 ESLint CLI를 사용한다.

다음 위반은 ESLint `error` 수준으로 검사한다.

- 명시적 `any`
- 처리되지 않은 Promise
- Promise를 잘못 전달한 콜백
- 사용하지 않는 변수와 import
- React Hooks 규칙
- Next.js App Router 규칙
- 접근성 위반
- 설명 없는 `@ts-expect-error`
- `@ts-ignore`와 `@ts-nocheck`
- 판별 가능한 유니온을 처리하는 switch의 case 누락
- 위험한 타입 기반 호출, 할당 및 반환
- 커밋된 `test.only`
- Tailwind 중복 클래스

- ESLint warning은 CI 출력에 표시하지만 CI 실패 조건으로 사용하지 않는다.
- CI에서 `--max-warnings=0`을 사용하지 않는다.
- 억제가 필요하면 가장 좁은 범위에 한글 사유를 작성한다.
- 규칙을 통과시키기 위해 검사 대상 파일이나 디렉터리를 광범위하게 제외하지 않는다.
- 생성 파일과 `.next`, coverage 및 Playwright 결과물만 명시적으로 제외한다.

```text
eslint .
```

## import와 파일명 검사

- import 정렬에는 `eslint-plugin-simple-import-sort`를 사용한다.
- 외부 패키지, `@/` 내부 경로, 상대 경로, CSS 등 부수 효과 순으로 그룹을 설정한다.
- import 순서 오류는 ESLint 자동 수정 대상으로 처리한다.
- 순수 type import 여부는 ESLint와 TypeScript가 검사한다.
- 혼합 import의 인라인 `type` 형식은 승인된 규칙과 자동 수정 결과가 충돌하지 않도록 설정한다.
- 파일명은 가능한 범위에서 `kebab-case`와 `PascalCase`만 허용하도록 검사한다.
- 컴포넌트 여부를 도구가 확실히 판단하지 못하면 컴포넌트와 일반 파일의 정확한 구분은 코드 리뷰에서 확인한다.
- Next.js 특수 파일과 동적 라우트 폴더는 파일명 검사 예외로 명시한다.

## Prettier

다음 최소 옵션을 사용한다.

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "endOfLine": "lf"
}
```

- JSX 속성은 Prettier 기본값인 큰따옴표를 사용한다.
- TypeScript, TSX, JavaScript, JSON, CSS 및 Markdown을 검사 대상에 포함한다.
- 생성 파일과 lockfile처럼 직접 포맷하면 안 되는 파일은 제외한다.
- CI에서는 `--check`만 사용하고 파일을 자동 수정하거나 커밋하지 않는다.
- 개발자가 명시적으로 실행하는 `format` 명령에서만 `--write`를 사용한다.
- Prettier 버전은 저장소 dev dependency로 고정한다.

## Tailwind CSS

- 공식 `prettier-plugin-tailwindcss`를 사용한다.
- 플러그인이 정한 공식 클래스 순서를 그대로 사용한다.
- 동적 클래스 조합은 플러그인이 인식할 수 있는 형태를 우선한다.
- 자동 정렬을 피하려고 클래스 문자열을 불필요하게 분리하지 않는다.

## TypeScript

- `tsconfig.json`에서 `strict: true`를 사용한다.
- `tsc --noEmit`을 독립적인 `typecheck` 명령으로 실행한다.
- Next.js 빌드의 타입 검사만 의존하지 않는다.
- 타입 오류를 무시하고 빌드를 계속하는 설정을 사용하지 않는다.
- 에디터에서는 저장소의 workspace TypeScript 버전을 사용한다.
- `package-lock.json`을 커밋하고 CI에서는 `npm ci`를 사용한다.

## npm scripts

다음 표준 script를 제공한다.

```json
{
  "scripts": {
    "format": "prettier . --write",
    "format:check": "prettier . --check",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "build": "next build",
    "check": "npm run format:check && npm run lint && npm run typecheck && npm run test"
  }
}
```

- `format`과 `lint:fix`는 로컬 수정용으로 사용한다.
- `check`와 CI 명령은 저장소 파일을 변경하지 않는다.
- CI와 로컬에서 동일한 npm script를 사용한다.
- 실패한 검사를 우회하는 별도의 느슨한 script를 만들지 않는다.

## 테스트와 coverage

- 모든 PR에서 Vitest를 실행한다.
- 앱 동작에 영향을 주는 PR에서 Playwright 핵심 흐름을 실행한다.
- 도메인 문서에서 필수로 지정한 테스트가 누락되면 merge하지 않는다.
- 초기 구현에서 coverage 기준선을 측정한 후 threshold를 확정한다.
- 이후 threshold를 낮추려면 이유를 설명하고 별도 승인을 받는다.
- flaky 테스트 재시도는 최대 1회이며 재시도에서만 성공해도 추적하고 수정한다.
- Playwright 실패 trace를 CI artifact로 보존한다.
- screenshot baseline 변경을 자동 승인하지 않는다.
- 문서 전용 PR에서 E2E를 생략할 수 있지만 required check가 대기 상태로 남지 않도록 workflow를 구성한다.

## Markdown과 링크

- `markdownlint-cli2`로 모든 Markdown 문서의 구조를 검사한다.
- 코드 블록과 목록 주변의 빈 줄, 제목 단계 및 trailing whitespace를 검사한다.
- 일반 문서에는 고정 줄 길이를 강제하지 않는다.
- 로컬 파일 경로와 내부 Markdown 링크를 검사한다.
- 외부 링크는 Lychee 같은 링크 검사기로 CI에서 확인한다.
- 일시적인 외부 사이트 장애와 실제 broken link를 구분하도록 제한된 재시도와 cache를 사용한다.
- 링크 검사 예외에는 구체적인 사유를 기록한다.

## PR 제목

- squash merge의 최종 메시지가 되는 PR 제목을 GitHub Actions에서 검사한다.
- 작업 브랜치의 임시 커밋에는 commitlint를 강제하지 않는다.
- 최종 squash 제목은 merge 전에 Conventional Commits 규칙을 통과해야 한다.
- 허용 type은 커밋 규칙에서 합의한 목록과 동일하다.
- 설명이 비어 있거나 type 형식이 잘못된 PR 제목은 검사에 실패한다.

## GitHub Actions와 merge gate

- pull request와 `main` push에서 CI를 실행한다.
- CI는 `npm ci`, Prettier, ESLint, TypeScript, Vitest, coverage, Next.js build, Playwright, Markdown, 링크 및 PR 제목 검사를 수행한다.
- 서로 독립적인 검사는 가능한 범위에서 병렬로 실행한다.
- 검사 이름은 workflow 사이에서 중복되지 않게 고정한다.
- 최신 커밋에서 모든 필수 검사가 통과해야 merge할 수 있다.
- `main`에 required status checks와 conversation resolution을 적용한다.
- CI에서는 자동 수정 커밋을 만들지 않는다.
- GitHub Actions는 변경 가능한 branch가 아니라 고정 release 또는 commit SHA로 참조한다.
- 로컬 에디터 설정이나 pre-commit hook보다 CI 결과를 최종 기준으로 사용한다.

## pre-commit hook

- 초기에는 Husky, lint-staged 등 pre-commit hook을 필수로 적용하지 않는다.
- 명시적인 `npm run check`와 GitHub Actions를 기준으로 사용한다.
- 에디터의 format-on-save 사용은 개인 선택으로 둔다.
- 포맷 또는 lint 실패가 반복되면 별도 합의를 거쳐 lint-staged hook을 추가한다.
- hook을 추가하더라도 CI 검사를 대체하지 않는다.
