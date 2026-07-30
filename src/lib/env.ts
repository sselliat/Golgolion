import { z } from 'zod';

import { APP_INTERNAL_ERROR_MESSAGE } from './app-error-constants';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_APP_URL: z.url().default('http://localhost:3000'),
});

export type Environment = z.infer<typeof environmentSchema>;

export function parseEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): Environment {
  const result = environmentSchema.safeParse(environment);

  if (!result.success) {
    throw new Error(APP_INTERNAL_ERROR_MESSAGE.INVALID_ENVIRONMENT, {
      cause: result.error,
    });
  }

  return result.data;
}

export const env = Object.freeze(parseEnvironment(process.env));
