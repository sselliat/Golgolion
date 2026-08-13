import { afterEach, describe, expect, test, vi } from 'vitest';

import { fetchWithTimeout, NeopleTransportError } from './neople-client-transport';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function getError(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error: unknown) {
    if (error instanceof Error) {
      return error;
    }
  }
  throw new Error('실패해야 하는 요청이 성공했습니다.');
}

describe('fetchWithTimeout', () => {
  test('호출자가 주입한 fetch와 새 AbortSignal을 사용한다', async () => {
    const globalFetch = vi.fn<typeof fetch>();
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', globalFetch);

    await fetchWithTimeout(fetchImpl, 'https://example.test/items?apikey=secret', {
      method: 'GET',
    });

    expect(globalFetch).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  test('호출마다 서로 다른 AbortSignal을 전달한다', async () => {
    const signals: AbortSignal[] = [];
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (_input, init) => {
      if (!init?.signal) {
        throw new Error('signal missing');
      }
      signals.push(init.signal);
      return await Promise.resolve(new Response(null, { status: 204 }));
    });

    await fetchWithTimeout(fetchImpl, 'https://example.test/one');
    await fetchWithTimeout(fetchImpl, 'https://example.test/two');

    expect(signals).toHaveLength(2);
    expect(signals[0]).not.toBe(signals[1]);
  });

  test('10초 후 요청을 중단하고 timeout 오류를 정제한다', async () => {
    vi.useFakeTimers();
    const secret = 'network-secret-apikey';
    let signal: AbortSignal | undefined;
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (_input, init) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new Error(secret)), { once: true });
      });
    });

    const result = fetchWithTimeout(fetchImpl, 'https://example.test/items?apikey=secret');
    const failure = getError(result);
    await vi.advanceTimersByTimeAsync(9_999);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    const error = await failure;
    expect(error).toBeInstanceOf(NeopleTransportError);
    expect(error).toMatchObject({ code: 'timeout', message: 'Neople request timed out.' });
    expect(`${error.message} ${JSON.stringify(error)}`).not.toContain(secret);
    expect(`${error.message} ${JSON.stringify(error)}`).not.toContain('apikey=secret');
  });

  test('네트워크 예외를 원문 없이 network 오류로 변환한다', async () => {
    const secret = 'network-secret-apikey';
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new Error(secret));

    const result = fetchWithTimeout(fetchImpl, 'https://example.test/items?apikey=secret');
    const error = await getError(result);

    expect(error).toMatchObject({ code: 'network' });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(`${error.message} ${JSON.stringify(error)}`).not.toContain(secret);
    expect(`${error.message} ${JSON.stringify(error)}`).not.toContain('apikey=secret');
  });

  test('HTTP 응답은 상태를 해석하지 않고 그대로 반환한다', async () => {
    const response = new Response('busy', { status: 503 });
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response);

    await expect(fetchWithTimeout(fetchImpl, 'https://example.test/items')).resolves.toBe(response);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
