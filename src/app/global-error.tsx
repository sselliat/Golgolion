'use client';

import { APP_ERROR_MESSAGE } from '@/lib/app-error-constants';

interface GlobalErrorProps {
  unstable_retry: () => void;
}

export default function GlobalError({ unstable_retry }: GlobalErrorProps) {
  return (
    <html lang="ko">
      <body>
        <main
          style={{
            maxWidth: '36rem',
            margin: '0 auto',
            padding: '6rem 1.5rem',
            fontFamily: 'Arial, Helvetica, sans-serif',
          }}
        >
          <title>오류 | Golgolion</title>
          <h1>서비스를 불러오지 못했습니다.</h1>
          <p>{APP_ERROR_MESSAGE.UNEXPECTED}</p>
          <button type="button" onClick={unstable_retry}>
            다시 시도
          </button>
        </main>
      </body>
    </html>
  );
}
