import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  executeWithRetry,
  NEOPLE_RETRY_ERROR_CODE,
  NEOPLE_RETRY_ERROR_MESSAGE,
  NeopleRetryError,
} from './neople-client-retry';

const response = (status: number): Response => new Response(null, { status });

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('executeWithRetry', () => {
  test('첫 시도가 성공하면 재시도 없이 결과를 반환한다', async () => {
    const transport = vi.fn(async () => await Promise.resolve(response(200)));
    const parseResponse = vi.fn(() => 'ok');
    const sleep = vi.fn(async () => {
      await Promise.resolve();
    });

    await expect(executeWithRetry({ transport, parseResponse, sleep })).resolves.toBe('ok');
    expect(transport).toHaveBeenCalledOnce();
    expect(parseResponse).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });

  test('429와 5xx는 250ms와 500ms 후 총 세 번 시도한다', async () => {
    const transport = vi
      .fn<(attempt: number) => Promise<Response>>()
      .mockResolvedValueOnce(response(429))
      .mockResolvedValueOnce(response(503))
      .mockResolvedValueOnce(response(200));
    const parseResponse = vi.fn(() => 'ok');
    const sleep = vi.fn(async () => {
      await Promise.resolve();
    });

    await expect(executeWithRetry({ transport, parseResponse, sleep })).resolves.toBe('ok');
    expect(transport).toHaveBeenCalledTimes(3);
    expect(transport.mock.calls.map(([attempt]) => attempt)).toEqual([1, 2, 3]);
    expect(sleep).toHaveBeenNthCalledWith(1, 250);
    expect(sleep).toHaveBeenNthCalledWith(2, 500);
    expect(parseResponse).toHaveBeenCalledOnce();
  });

  test.for([
    { failure: { code: NEOPLE_RETRY_ERROR_CODE.TIMEOUT }, code: NEOPLE_RETRY_ERROR_CODE.TIMEOUT },
    { failure: new Error('network secret'), code: NEOPLE_RETRY_ERROR_CODE.NETWORK },
  ])('$code 오류는 세 번 시도 후 분류한다', async ({ failure, code }) => {
    const transport = vi.fn<() => Promise<Response>>().mockRejectedValue(failure);
    const sleep = vi.fn(async () => {
      await Promise.resolve();
    });

    const result = executeWithRetry({ transport, parseResponse: () => 'unused', sleep });

    await expect(result).rejects.toMatchObject({ code, message: NEOPLE_RETRY_ERROR_MESSAGE[code] });
    await expect(result).rejects.toBeInstanceOf(NeopleRetryError);
    expect(transport).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  test.for([
    { status: 429, code: NEOPLE_RETRY_ERROR_CODE.RATE_LIMIT },
    { status: 503, code: NEOPLE_RETRY_ERROR_CODE.UPSTREAM_HTTP },
  ])('$status는 세 번 시도 후 $code로 실패한다', async ({ status, code }) => {
    const transport = vi.fn(async () => await Promise.resolve(response(status)));
    const sleep = vi.fn(async () => {
      await Promise.resolve();
    });

    await expect(
      executeWithRetry({ transport, parseResponse: () => 'unused', sleep }),
    ).rejects.toMatchObject({
      code,
    });
    expect(transport).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 250);
    expect(sleep).toHaveBeenNthCalledWith(2, 500);
  });

  test.for([
    { status: 400, code: NEOPLE_RETRY_ERROR_CODE.NON_RETRYABLE_HTTP },
    { status: 401, code: NEOPLE_RETRY_ERROR_CODE.NON_RETRYABLE_HTTP },
    { status: 403, code: NEOPLE_RETRY_ERROR_CODE.NON_RETRYABLE_HTTP },
    { status: 404, code: NEOPLE_RETRY_ERROR_CODE.NON_RETRYABLE_HTTP },
    { status: 422, code: NEOPLE_RETRY_ERROR_CODE.NON_RETRYABLE_HTTP },
  ])('$status는 한 번만 호출하고 $code로 실패한다', async ({ status, code }) => {
    const transport = vi.fn(async () => await Promise.resolve(response(status)));
    const sleep = vi.fn(async () => {
      await Promise.resolve();
    });

    await expect(
      executeWithRetry({ transport, parseResponse: () => 'unused', sleep }),
    ).rejects.toMatchObject({
      code,
    });
    expect(transport).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });

  test.for([
    { error: new SyntaxError('body secret'), code: NEOPLE_RETRY_ERROR_CODE.INVALID_JSON },
    {
      error: new Error('body secret'),
      code: NEOPLE_RETRY_ERROR_CODE.INVALID_RESPONSE,
    },
  ])('$code는 파서 실패 시 재시도하지 않는다', async ({ error, code }) => {
    const transport = vi.fn(async () => await Promise.resolve(response(200)));
    const parseResponse = vi.fn(() => {
      throw error;
    });
    const sleep = vi.fn(async () => {
      await Promise.resolve();
    });

    await expect(executeWithRetry({ transport, parseResponse, sleep })).rejects.toMatchObject({
      code,
    });
    expect(transport).toHaveBeenCalledOnce();
    expect(parseResponse).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });

  test('재시도 가능한 실패 뒤 파서 실패가 오면 즉시 중단한다', async () => {
    const transport = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(response(503))
      .mockResolvedValueOnce(response(200));
    const parseResponse = vi.fn(() => {
      throw new SyntaxError('body secret');
    });
    const sleep = vi.fn(async () => {
      await Promise.resolve();
    });

    await expect(executeWithRetry({ transport, parseResponse, sleep })).rejects.toMatchObject({
      code: NEOPLE_RETRY_ERROR_CODE.INVALID_JSON,
    });
    expect(transport).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledOnce();
  });

  test('주입한 sleep을 fake timer로 제어해 실제 대기 없이 backoff를 검증한다', async () => {
    vi.useFakeTimers();
    const transport = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(response(500))
      .mockResolvedValueOnce(response(200));
    const parseResponse = vi.fn(() => 'ok');
    const sleep = vi.fn(async (delayMs: number) => {
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    });

    const result = executeWithRetry({ transport, parseResponse, sleep });
    await Promise.resolve();
    await Promise.resolve();
    expect(sleep).toHaveBeenCalledWith(250);
    expect(transport).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(249);
    expect(transport).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBe('ok');
    expect(transport).toHaveBeenCalledTimes(2);
  });

  test('오류 메시지와 직렬화 결과에 URL·본문·네트워크 원문을 노출하지 않는다', async () => {
    const apiKey = 'api-key-secret';
    const query = `https://api.neople.co.kr/df/auction?apikey=${apiKey}`;
    const body = 'upstream body secret';
    const sleep = vi.fn(async () => {
      await Promise.resolve();
    });

    const error = await executeWithRetry({
      transport: () => {
        throw new Error(`${query} ${body}`);
      },
      parseResponse: () => 'unused',
      sleep,
    }).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(NeopleRetryError);
    expect(String(error)).not.toContain(apiKey);
    expect(String(error)).not.toContain(query);
    expect(String(error)).not.toContain(body);
    expect(JSON.stringify(error)).not.toContain(apiKey);
    expect(JSON.stringify(error)).not.toContain(query);
    expect(JSON.stringify(error)).not.toContain(body);
    expect((error as NeopleRetryError).cause).toBeUndefined();
  });
});
