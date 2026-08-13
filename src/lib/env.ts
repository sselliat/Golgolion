import { APP_INTERNAL_ERROR_MESSAGE } from './app-error-constants';

export type Environment = {
  NODE_ENV: 'development' | 'test' | 'production';
  NEXT_PUBLIC_APP_URL: string;
};

export function parseEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): Environment {
  const NODE_ENV = environment.NODE_ENV ?? 'development';
  const NEXT_PUBLIC_APP_URL = environment.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  try {
    if (NODE_ENV !== 'development' && NODE_ENV !== 'test' && NODE_ENV !== 'production') {
      throw new TypeError('Invalid NODE_ENV');
    }
    new URL(NEXT_PUBLIC_APP_URL);
  } catch (cause) {
    throw new Error(APP_INTERNAL_ERROR_MESSAGE.INVALID_ENVIRONMENT, {
      cause,
    });
  }

  return { NODE_ENV, NEXT_PUBLIC_APP_URL };
}

export const env = Object.freeze(parseEnvironment(process.env));
