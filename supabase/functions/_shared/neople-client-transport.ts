export type TransportErrorCode = 'timeout' | 'network';

export class NeopleTransportError extends Error {
  constructor(
    public readonly code: TransportErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'NeopleTransportError';
  }
}

export async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 10_000);

  try {
    return await fetchImpl(input, { ...init, signal: controller.signal });
  } catch {
    throw new NeopleTransportError(
      timedOut ? 'timeout' : 'network',
      timedOut ? 'Neople request timed out.' : 'Neople request failed.',
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
