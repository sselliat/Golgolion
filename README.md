# Golgolion

던전앤파이터 아이템 `+10 장비 증폭권[골고라이언]`의 시세를 제공하기 위한 Next.js 앱이다.

## 요구 환경

- Node.js 20.9 이상
- Node.js에 포함된 npm

## 시작하기

```bash
npm ci
Copy-Item .env.example .env.local
npm run dev
```

브라우저에서 <http://localhost:3000>에 접속한다.

## 환경변수

| 이름                  | 설명               | 예시                    |
| --------------------- | ------------------ | ----------------------- |
| `NEXT_PUBLIC_APP_URL` | 앱의 공개 기준 URL | `http://localhost:3000` |

환경변수는 앱 시작 및 빌드 시 Zod로 검증된다. `.env.local` 같은 실제 환경 파일은 커밋하지 않는다.

## 검사

```bash
npm run check
npm run build
npm run test:e2e
```

`npm run check`는 Prettier, ESLint, TypeScript 및 Vitest를 순서대로 실행한다.
