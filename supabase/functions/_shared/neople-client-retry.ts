export const NEOPLE_RETRY_ERROR_CODE = {
  TIMEOUT: 'timeout',
  NETWORK: 'network',
  RATE_LIMIT: 'rate_limit',
  UPSTREAM_HTTP: 'upstream_http',
  NON_RETRYABLE_HTTP: 'non_retryable_http',
  INVALID_JSON: 'invalid_json',
  INVALID_RESPONSE: 'invalid_response',
} as const;

export type NeopleRetryErrorCode =
  (typeof NEOPLE_RETRY_ERROR_CODE)[keyof typeof NEOPLE_RETRY_ERROR_CODE];

export const NEOPLE_RETRY_ERROR_MESSAGE = {
  [NEOPLE_RETRY_ERROR_CODE.TIMEOUT]: 'Neople API request timed out.',
  [NEOPLE_RETRY_ERROR_CODE.NETWORK]: 'Neople API network request failed.',
  [NEOPLE_RETRY_ERROR_CODE.RATE_LIMIT]: 'Neople API rate limit exceeded.',
  [NEOPLE_RETRY_ERROR_CODE.UPSTREAM_HTTP]: 'Neople API is temporarily unavailable.',
  [NEOPLE_RETRY_ERROR_CODE.NON_RETRYABLE_HTTP]: 'Neople API rejected the request.',
  [NEOPLE_RETRY_ERROR_CODE.INVALID_JSON]: 'Neople API returned invalid JSON.',
  [NEOPLE_RETRY_ERROR_CODE.INVALID_RESPONSE]: 'Neople API returned an invalid response.',
} as const satisfies Record<NeopleRetryErrorCode, string>;

export const NEOPLE_RETRY_DELAYS_MS = [250, 500] as const;
export const NEOPLE_RETRY_MAX_ATTEMPTS = 3;

export class NeopleRetryError extends Error {
  readonly code: NeopleRetryErrorCode;

  constructor(code: NeopleRetryErrorCode) {
    super(NEOPLE_RETRY_ERROR_MESSAGE[code]);
    this.name = 'NeopleRetryError';
    this.code = code;
  }
}

export interface NeopleRetryCallbacks<T> {
  transport: (attempt: number) => Promise<Response>;
  parseResponse: (response: Response, attempt: number) => Promise<T> | T;
  sleep: (delayMs: number) => Promise<void>;
}

type RetryableErrorCode =
  | typeof NEOPLE_RETRY_ERROR_CODE.TIMEOUT
  | typeof NEOPLE_RETRY_ERROR_CODE.NETWORK
  | typeof NEOPLE_RETRY_ERROR_CODE.RATE_LIMIT
  | typeof NEOPLE_RETRY_ERROR_CODE.UPSTREAM_HTTP;

function errorCode(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || !('code' in value)) {
    return undefined;
  }

  const code = value.code;
  return typeof code === 'string' ? code : undefined;
}

function transportErrorCode(value: unknown): RetryableErrorCode {
  const code = errorCode(value);
  if (code === NEOPLE_RETRY_ERROR_CODE.TIMEOUT) {
    return code;
  }
  if (code === NEOPLE_RETRY_ERROR_CODE.NETWORK) {
    return code;
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    (value.name === 'AbortError' || value.name === 'TimeoutError')
  ) {
    return NEOPLE_RETRY_ERROR_CODE.TIMEOUT;
  }
  return NEOPLE_RETRY_ERROR_CODE.NETWORK;
}

function parserErrorCode(
  value: unknown,
): typeof NEOPLE_RETRY_ERROR_CODE.INVALID_JSON | typeof NEOPLE_RETRY_ERROR_CODE.INVALID_RESPONSE {
  const code = errorCode(value);
  if (code === NEOPLE_RETRY_ERROR_CODE.INVALID_JSON) {
    return code;
  }
  if (code === NEOPLE_RETRY_ERROR_CODE.INVALID_RESPONSE) {
    return code;
  }
  if (value instanceof SyntaxError) {
    return NEOPLE_RETRY_ERROR_CODE.INVALID_JSON;
  }
  return NEOPLE_RETRY_ERROR_CODE.INVALID_RESPONSE;
}

function httpErrorCode(
  status: number,
): RetryableErrorCode | typeof NEOPLE_RETRY_ERROR_CODE.NON_RETRYABLE_HTTP {
  if (status === 429) {
    return NEOPLE_RETRY_ERROR_CODE.RATE_LIMIT;
  }
  if (status >= 500 && status <= 599) {
    return NEOPLE_RETRY_ERROR_CODE.UPSTREAM_HTTP;
  }
  return NEOPLE_RETRY_ERROR_CODE.NON_RETRYABLE_HTTP;
}

function isRetryable(code: NeopleRetryErrorCode): code is RetryableErrorCode {
  return (
    code === NEOPLE_RETRY_ERROR_CODE.TIMEOUT ||
    code === NEOPLE_RETRY_ERROR_CODE.NETWORK ||
    code === NEOPLE_RETRY_ERROR_CODE.RATE_LIMIT ||
    code === NEOPLE_RETRY_ERROR_CODE.UPSTREAM_HTTP
  );
}

async function attempt<T>(callbacks: NeopleRetryCallbacks<T>, attemptNumber: number): Promise<T> {
  let response: Response;
  try {
    response = await callbacks.transport(attemptNumber);
  } catch (cause: unknown) {
    throw new NeopleRetryError(transportErrorCode(cause));
  }

  if (response.status < 200 || response.status > 299) {
    throw new NeopleRetryError(httpErrorCode(response.status));
  }

  try {
    return await callbacks.parseResponse(response, attemptNumber);
  } catch (cause: unknown) {
    throw new NeopleRetryError(parserErrorCode(cause));
  }
}

export async function executeWithRetry<T>(callbacks: NeopleRetryCallbacks<T>): Promise<T> {
  for (let attemptNumber = 1; attemptNumber <= NEOPLE_RETRY_MAX_ATTEMPTS; attemptNumber += 1) {
    try {
      return await attempt(callbacks, attemptNumber);
    } catch (cause: unknown) {
      if (!(cause instanceof NeopleRetryError) || !isRetryable(cause.code)) {
        throw cause;
      }
      if (attemptNumber === NEOPLE_RETRY_MAX_ATTEMPTS) {
        throw cause;
      }
      await callbacks.sleep(NEOPLE_RETRY_DELAYS_MS[attemptNumber - 1]);
    }
  }

  throw new NeopleRetryError(NEOPLE_RETRY_ERROR_CODE.INVALID_RESPONSE);
}
