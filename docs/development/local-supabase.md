# 로컬 Supabase 개발 환경

이 저장소는 `supabase` npm 개발 의존성과 `package-lock.json`으로 Supabase CLI
버전을 고정한다. 전역 Supabase CLI를 설치하거나 원격 Supabase 프로젝트에
연결하지 않는다.

## 요구 환경

- 저장소 루트의 `package.json`에 명시된 Node.js 버전
- Node.js에 포함된 npm
- Docker CLI를 제공하는 실행 중인 Docker 호환 런타임

Windows에서는 Docker Desktop처럼 `docker version`으로 서버 연결을 확인할 수
있는 런타임을 먼저 실행한다. CLI가 없거나 서버에 연결되지 않으면 로컬 Supabase를
시작할 수 없다.

```powershell
docker version
```

## 최초 설정

저장소 루트에서 의존성을 설치하고 고정된 CLI 버전을 확인한다.

```powershell
npm ci
npm run supabase:version
```

`supabase/config.toml`은 `supabase init`이 생성한 로컬 프로젝트 설정이다. 새로
초기화하거나 덮어쓰지 말고 저장소의 설정을 사용한다.

## 시작과 상태 확인

```powershell
npm run supabase:start
npm run supabase:status
```

첫 시작은 필요한 컨테이너 이미지를 내려받으므로 시간이 걸릴 수 있다. 상태
명령이 로컬 API, 데이터베이스 및 Studio 정보를 반환하면 실행 준비가 된 것이다.

로컬 서비스가 출력하는 URL과 키가 필요하면 다음 명령으로 현재 런타임 값을
확인한다.

```powershell
npm run supabase:status -- -o env
```

Supabase CLI의 로컬 시작에는 별도 환경변수가 필요하지 않다. 현재 앱에서 필요한
환경변수 이름은 `.env.example`에만 기록하며, 로컬 상태 명령이 출력한 키를 비롯한
실제 값은 Git에서 제외되는 `.env.local`에만 둔다. 서비스 역할 키와 기타 비밀값을
`supabase/config.toml`, `.env.example` 또는 문서에 복사하지 않는다.

## 중지

```powershell
npm run supabase:stop
```

중지 후 `npm run supabase:status`는 로컬 스택이 실행 중이 아니라고 보고해야 한다.

## 디렉터리 규칙

`supabase/`는 Supabase CLI가 요구하는 도구 전용 디렉터리이므로 일반 구현 파일을
`src/` 아래에 두는 규칙의 예외다.

```text
supabase/
├─ config.toml       # Git에 포함하는 로컬 프로젝트 설정
├─ migrations/       # 후속 작업에서 CLI가 생성할 데이터베이스 마이그레이션
├─ functions/        # 후속 작업에서 CLI가 생성할 Edge Function
├─ .branches/        # 로컬 생성물, Git 제외
└─ .temp/            # 로컬 생성물, Git 제외
```

제품 테이블, 마이그레이션 및 Edge Function 로직은 각 후속 이슈에서 추가한다.
`supabase/.gitignore`는 CLI가 생성하는 임시 파일과 로컬 환경 파일을 제외하며,
저장소 루트 `.gitignore`는 `.env.example`을 제외한 환경 파일을 제외한다.

## 데이터베이스 마이그레이션 검증

로컬 스택을 시작한 뒤 마이그레이션을 처음부터 다시 적용하고 데이터베이스 테스트와
린트를 실행한다. `supabase:db:reset`은 로컬 데이터베이스를 삭제하고 저장소의
마이그레이션으로 다시 만들므로 운영 또는 공유 데이터베이스에는 실행하지 않는다.

```powershell
npm run supabase:start
npm run supabase:db:reset
npm run supabase:test:db
npm run supabase:db:lint
```

데이터베이스 테스트는 `supabase/tests/database/`에 두며 pgTAP 형식으로 작성한다.
원격 프로젝트를 연결하지 않고 고정된 로컬 CLI와 Docker 런타임만 사용한다.

## PR 검증

로컬 Supabase 관련 변경은 다음 순서로 검증하고 실제 결과를 PR 본문에 기록한다.

```powershell
npm ci
npm run supabase:version
npm run check
npm run build
git diff --check
```

데이터베이스 검증은 위의 [데이터베이스 마이그레이션 검증](#데이터베이스-마이그레이션-검증)
절에 적힌 순서대로 별도 실행한다.

Docker 호환 런타임을 사용할 수 없어 시작과 상태 확인을 검증하지 못하면 PR을
완료 처리하지 않고 차단 사유를 기록한다.
