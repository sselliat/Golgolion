import { describe, expect, test } from 'vitest';

import { APP_INTERNAL_ERROR_MESSAGE } from './app-error-constants';
import { parseEnvironment } from './env';

describe('parseEnvironment', () => {
  test('값이 없으면 개발용 기본값을 반환한다', () => {
    expect(parseEnvironment({})).toEqual({
      NODE_ENV: 'development',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    });
  });

  test('유효한 배포 환경변수를 반환한다', () => {
    expect(
      parseEnvironment({
        NODE_ENV: 'production',
        NEXT_PUBLIC_APP_URL: 'https://golgolion.example.com',
      }),
    ).toEqual({
      NODE_ENV: 'production',
      NEXT_PUBLIC_APP_URL: 'https://golgolion.example.com',
    });
  });

  test('잘못된 환경변수면 안전한 설정 오류를 발생시킨다', () => {
    expect(() => parseEnvironment({ NODE_ENV: 'staging' })).toThrow(
      APP_INTERNAL_ERROR_MESSAGE.INVALID_ENVIRONMENT,
    );
    expect(() => parseEnvironment({ NEXT_PUBLIC_APP_URL: 'not-a-url' })).toThrow(
      APP_INTERNAL_ERROR_MESSAGE.INVALID_ENVIRONMENT,
    );
  });
});
