import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import auctionDefaultFixture from '../../../docs/validation/neople/fixtures/auction-default.json';
import auctionSoldFixture from '../../../docs/validation/neople/fixtures/auction-sold.json';
import auctionUnitPriceFixture from '../../../docs/validation/neople/fixtures/auction-unit-price-asc.json';

const API_KEY = 'test-api-key';
const CLIENT_MODULE_PATH = './neople-client';
const ITEM_ID = '4a737b2ae337a57260ca4663ce6a9bb0';
const soldRow = auctionSoldFixture.rows[0];
const listingRow = auctionUnitPriceFixture.rows[0];

interface NeopleRequestOptions {
  apiKey: string;
  fetch: typeof fetch;
  itemId: string;
}

type NeopleRequest = (options: NeopleRequestOptions) => Promise<unknown>;

interface NeopleClientModule {
  fetchAuctionListings: NeopleRequest;
  fetchCompletedTrades: NeopleRequest;
}

let client: NeopleClientModule;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

function sequenceFetch(...results: Array<Error | Response>) {
  let index = 0;

  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
    const result = results[index];
    index += 1;

    if (result instanceof Error) {
      throw result;
    }
    if (!result) {
      throw new Error('mock fetch 응답이 부족합니다.');
    }

    return await Promise.resolve(result);
  });
}

function isNeopleClientModule(value: unknown): value is NeopleClientModule {
  return (
    typeof value === 'object' &&
    value !== null &&
    'fetchAuctionListings' in value &&
    typeof value.fetchAuctionListings === 'function' &&
    'fetchCompletedTrades' in value &&
    typeof value.fetchCompletedTrades === 'function'
  );
}

function requestUrl(input: RequestInfo | URL): URL {
  return new URL(input instanceof Request ? input.url : input);
}

function soldResponse(changes: Record<string, unknown> = {}): unknown {
  return { rows: [{ ...soldRow, ...changes }] };
}

function listingResponse(changes: Record<string, unknown> = {}): unknown {
  return { rows: [{ ...listingRow, ...changes }] };
}

function withoutField(row: Record<string, unknown>, field: string): Record<string, unknown> {
  const copy = { ...row };
  delete copy[field];
  return copy;
}

function errorCode(result: unknown): unknown {
  if (typeof result !== 'object' || result === null || !('error' in result)) {
    return undefined;
  }

  const { error } = result;
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }

  return error.code;
}

async function expectFailure(
  resultPromise: Promise<unknown>,
  expectedCode: string,
): Promise<unknown> {
  const result = await resultPromise;

  expect(result).toMatchObject({ ok: false, error: { code: expectedCode } });
  expect(errorCode(result)).toMatch(/^[a-z][a-z0-9-]{0,63}$/);

  return result;
}

async function completedTrades(
  fetchImplementation: typeof fetch,
  apiKey = API_KEY,
  itemId = ITEM_ID,
): Promise<unknown> {
  return await client.fetchCompletedTrades({ apiKey, fetch: fetchImplementation, itemId });
}

async function auctionListings(
  fetchImplementation: typeof fetch,
  apiKey = API_KEY,
  itemId = ITEM_ID,
): Promise<unknown> {
  return await client.fetchAuctionListings({ apiKey, fetch: fetchImplementation, itemId });
}

beforeAll(async () => {
  const loaded: unknown = await import(/* @vite-ignore */ CLIENT_MODULE_PATH);
  if (!isNeopleClientModule(loaded)) {
    throw new Error('neople-client가 필수 조회 함수를 export해야 합니다.');
  }
  client = loaded;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('네오플 경매장 요청', () => {
  test('체결 내역을 고정 기준 URL과 limit=100으로 조회한다', async () => {
    const fetchMock = sequenceFetch(jsonResponse({ rows: [] }));

    await completedTrades(fetchMock);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [input, init] = fetchMock.mock.calls[0];
    const url = requestUrl(input);
    expect(url.origin).toBe('https://api.neople.co.kr');
    expect(url.pathname).toBe('/df/auction-sold');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      apikey: API_KEY,
      itemId: ITEM_ID,
      limit: '100',
    });
    expect(init?.method).toBe('GET');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  test('등록 매물을 limit=400과 단가 오름차순으로 조회한다', async () => {
    const fetchMock = sequenceFetch(jsonResponse({ rows: [] }));

    await auctionListings(fetchMock);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [input, init] = fetchMock.mock.calls[0];
    const url = requestUrl(input);
    expect(url.origin).toBe('https://api.neople.co.kr');
    expect(url.pathname).toBe('/df/auction');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      apikey: API_KEY,
      itemId: ITEM_ID,
      limit: '400',
      sort: 'unitPrice:asc',
    });
    expect(init?.method).toBe('GET');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  test.for([
    { apiKey: '', itemId: ITEM_ID, name: '빈 API 키' },
    { apiKey: '   ', itemId: ITEM_ID, name: '공백 API 키' },
    { apiKey: API_KEY, itemId: '', name: '빈 itemId' },
    { apiKey: API_KEY, itemId: ITEM_ID.toUpperCase(), name: '대문자 itemId' },
    { apiKey: API_KEY, itemId: 'abc', name: '길이가 짧은 itemId' },
  ])('$name는 네트워크 요청 전에 거부한다', async ({ apiKey, itemId }) => {
    const fetchMock = sequenceFetch(jsonResponse({ rows: [] }));

    await expectFailure(completedTrades(fetchMock, apiKey, itemId), 'invalid-request');
    await expectFailure(auctionListings(fetchMock, apiKey, itemId), 'invalid-request');

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('정상 응답 변환', () => {
  test('체결 fixture를 검증된 최소 체결 값으로 변환한다', async () => {
    const result = await completedTrades(sequenceFetch(jsonResponse(auctionSoldFixture)));

    expect(result).toEqual({
      ok: true,
      data: auctionSoldFixture.rows.map(({ count, itemId, soldDate, unitPrice }) => ({
        itemId,
        quantity: count,
        soldAt: new Date(`${soldDate.replace(' ', 'T')}+09:00`).toISOString(),
        unitPrice,
      })),
    });
  });

  test.for([
    { fixture: auctionDefaultFixture, name: '기본 정렬 fixture' },
    { fixture: auctionUnitPriceFixture, name: '단가 오름차순 fixture' },
  ])('$name를 검증된 최소 등록 매물 값으로 변환한다', async ({ fixture }) => {
    const result = await auctionListings(sequenceFetch(jsonResponse(fixture)));

    expect(result).toEqual({
      ok: true,
      data: fixture.rows.map(({ itemId, unitPrice }) => ({ itemId, unitPrice })),
    });
  });

  test('빈 rows를 성공한 빈 결과로 반환한다', async () => {
    const sold = await completedTrades(sequenceFetch(jsonResponse({ rows: [] })));
    const listings = await auctionListings(sequenceFetch(jsonResponse({ rows: [] })));

    expect(sold).toEqual({ ok: true, data: [] });
    expect(listings).toEqual({ ok: true, data: [] });
  });

  test('사용하지 않는 추가 필드를 허용한다', async () => {
    const result = await completedTrades(
      sequenceFetch(
        jsonResponse({
          futureTopLevelField: true,
          rows: [{ ...soldRow, futureRowField: true }],
        }),
      ),
    );

    expect(result).toEqual({
      ok: true,
      data: [
        {
          itemId: ITEM_ID,
          quantity: soldRow.count,
          soldAt: '2026-07-30T13:50:19.000Z',
          unitPrice: soldRow.unitPrice,
        },
      ],
    });
  });

  test('서버 응답 순서를 검증하거나 재정렬하지 않는다', async () => {
    const expensive = { ...listingRow, count: 1, currentPrice: 20, regCount: 1, unitPrice: 20 };
    const cheap = { ...listingRow, count: 1, currentPrice: 10, regCount: 1, unitPrice: 10 };

    const result = await auctionListings(sequenceFetch(jsonResponse({ rows: [expensive, cheap] })));

    expect(result).toEqual({
      ok: true,
      data: [
        { itemId: ITEM_ID, unitPrice: 20 },
        { itemId: ITEM_ID, unitPrice: 10 },
      ],
    });
  });
});

describe('응답 검증', () => {
  test.for([
    { body: null, name: 'null' },
    { body: [], name: '배열' },
    { body: {}, name: 'rows 누락' },
    { body: { rows: null }, name: '배열이 아닌 rows' },
  ])('잘못된 최상위 구조($name)를 거부한다', async ({ body }) => {
    const fetchMock = sequenceFetch(jsonResponse(body));

    await expectFailure(completedTrades(fetchMock), 'invalid-response');

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test('엔드포인트별 최대 행 수를 초과하면 전체 응답을 거부한다', async () => {
    const soldFetch = sequenceFetch(jsonResponse({ rows: Array(101).fill(soldRow) }));
    const listingsFetch = sequenceFetch(jsonResponse({ rows: Array(401).fill(listingRow) }));

    await expectFailure(completedTrades(soldFetch), 'invalid-response');
    await expectFailure(auctionListings(listingsFetch), 'invalid-response');

    expect(soldFetch).toHaveBeenCalledOnce();
    expect(listingsFetch).toHaveBeenCalledOnce();
  });

  test.for([
    { name: 'soldDate 누락', row: withoutField(soldRow, 'soldDate') },
    { name: 'soldDate 자료형', row: { ...soldRow, soldDate: 1 } },
    { name: 'itemId 누락', row: withoutField(soldRow, 'itemId') },
    { name: '요청과 다른 itemId', row: { ...soldRow, itemId: '0'.repeat(32) } },
    { name: 'unitPrice 0', row: { ...soldRow, unitPrice: 0 } },
    { name: 'unitPrice 음수', row: { ...soldRow, unitPrice: -1 } },
    { name: 'unitPrice 실수', row: { ...soldRow, unitPrice: 1.5 } },
    {
      name: 'unitPrice unsafe integer',
      row: { ...soldRow, unitPrice: Number.MAX_SAFE_INTEGER + 1 },
    },
    { name: 'count 0', row: { ...soldRow, count: 0 } },
    { name: 'count 문자열', row: { ...soldRow, count: '1' } },
    { name: 'price 관계 불일치', row: { ...soldRow, price: soldRow.price + 1 } },
  ])('잘못된 체결 행($name)이 있으면 전체 응답을 거부한다', async ({ row }) => {
    const fetchMock = sequenceFetch(jsonResponse({ rows: [soldRow, row] }));

    await expectFailure(completedTrades(fetchMock), 'invalid-response');

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test.for([
    { name: 'auctionNo 누락', row: withoutField(listingRow, 'auctionNo') },
    { name: 'auctionNo 0', row: { ...listingRow, auctionNo: 0 } },
    {
      name: 'auctionNo unsafe integer',
      row: { ...listingRow, auctionNo: Number.MAX_SAFE_INTEGER + 1 },
    },
    { name: '요청과 다른 itemId', row: { ...listingRow, itemId: '0'.repeat(32) } },
    { name: 'unitPrice 문자열', row: { ...listingRow, unitPrice: '1' } },
    { name: 'count 음수', row: { ...listingRow, count: -1 } },
    { name: 'regCount 0', row: { ...listingRow, regCount: 0 } },
    {
      name: 'currentPrice 관계 불일치',
      row: { ...listingRow, currentPrice: listingRow.currentPrice + 1 },
    },
    { name: 'regCount가 count보다 작음', row: { ...listingRow, regCount: listingRow.count - 1 } },
  ])('잘못된 등록 매물 행($name)이 있으면 전체 응답을 거부한다', async ({ row }) => {
    const fetchMock = sequenceFetch(jsonResponse({ rows: [listingRow, row] }));

    await expectFailure(auctionListings(fetchMock), 'invalid-response');

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test.for([
    { name: '형식 오류', soldDate: '2026-07-30T22:50:19' },
    { name: '윤년이 아닌 2월 29일', soldDate: '2026-02-29 12:00:00' },
    { name: '4월 31일', soldDate: '2026-04-31 12:00:00' },
    { name: '13월', soldDate: '2026-13-01 12:00:00' },
    { name: '24시', soldDate: '2026-07-30 24:00:00' },
  ])('잘못된 체결 시각($name)을 거부한다', async ({ soldDate }) => {
    const fetchMock = sequenceFetch(jsonResponse(soldResponse({ soldDate })));

    await expectFailure(completedTrades(fetchMock), 'invalid-response');

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test('한국 시각을 UTC ISO 시각으로 변환한다', async () => {
    const result = await completedTrades(
      sequenceFetch(jsonResponse(soldResponse({ soldDate: '2024-02-29 00:00:00' }))),
    );

    expect(result).toMatchObject({
      ok: true,
      data: [{ soldAt: '2024-02-28T15:00:00.000Z' }],
    });
  });
});

describe('재시도와 오류 코드', () => {
  test('네트워크 오류는 250ms와 500ms 후 재시도한다', async () => {
    vi.useFakeTimers();
    const fetchMock = sequenceFetch(
      new TypeError('offline'),
      new TypeError('offline'),
      jsonResponse({ rows: [] }),
    );

    const resultPromise = completedTrades(fetchMock);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(249);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(499);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);

    await expect(resultPromise).resolves.toEqual({ ok: true, data: [] });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test.for([429, 500, 503])(
    'HTTP $status는 최대 두 번 재시도한 뒤 성공할 수 있다',
    async (status) => {
      vi.useFakeTimers();
      const fetchMock = sequenceFetch(
        jsonResponse({ error: 'temporary' }, status),
        jsonResponse({ error: 'temporary' }, status),
        jsonResponse({ rows: [] }),
      );

      const resultPromise = completedTrades(fetchMock);
      await vi.runAllTimersAsync();

      await expect(resultPromise).resolves.toEqual({ ok: true, data: [] });
      expect(fetchMock).toHaveBeenCalledTimes(3);
    },
  );

  test.for([
    {
      code: 'network',
      makeResults: () => [
        new TypeError('offline'),
        new TypeError('offline'),
        new TypeError('offline'),
      ],
      name: '네트워크 오류',
    },
    {
      code: 'rate-limit',
      makeResults: () => [jsonResponse({}, 429), jsonResponse({}, 429), jsonResponse({}, 429)],
      name: 'HTTP 429',
    },
    {
      code: 'upstream-http',
      makeResults: () => [jsonResponse({}, 500), jsonResponse({}, 500), jsonResponse({}, 500)],
      name: 'HTTP 5xx',
    },
  ])('$name 재시도 소진 후 $code 오류를 반환한다', async ({ code, makeResults }) => {
    vi.useFakeTimers();
    const fetchMock = sequenceFetch(...makeResults());

    const resultPromise = completedTrades(fetchMock);
    await vi.runAllTimersAsync();

    await expectFailure(resultPromise, code);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test('각 요청을 10초 후 중단하고 최대 두 번 재시도한다', async () => {
    vi.useFakeTimers();
    vi.spyOn(AbortSignal, 'timeout').mockImplementation((milliseconds) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException('timeout', 'TimeoutError')), milliseconds);
      return controller.signal;
    });
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
        await new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('timeout', 'TimeoutError')),
            {
              once: true,
            },
          );
        }),
    );

    const resultPromise = completedTrades(fetchMock);
    await vi.advanceTimersByTimeAsync(9_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(250);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.runAllTimersAsync();

    await expectFailure(resultPromise, 'timeout');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test('그 밖의 HTTP 4xx는 재시도하지 않는다', async () => {
    const fetchMock = sequenceFetch(jsonResponse({ error: 'bad request' }, 400));

    await expectFailure(completedTrades(fetchMock), 'non-retryable-http');

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test('잘못된 JSON은 재시도하지 않는다', async () => {
    const fetchMock = sequenceFetch(new Response('{', { status: 200 }));

    await expectFailure(completedTrades(fetchMock), 'invalid-json');

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test('잘못된 응답은 재시도하지 않는다', async () => {
    const fetchMock = sequenceFetch(jsonResponse(listingResponse({ unitPrice: 0 })));

    await expectFailure(auctionListings(fetchMock), 'invalid-response');

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test('직렬화한 오류에 API 키, 전체 URL과 원문 응답을 노출하지 않는다', async () => {
    vi.useFakeTimers();
    const secret = 'secret-value-that-must-not-leak';
    const fullUrl = `https://api.neople.co.kr/df/auction-sold?itemId=${ITEM_ID}&apikey=${secret}`;
    const networkFetch = sequenceFetch(
      new TypeError(fullUrl),
      new TypeError(fullUrl),
      new TypeError(fullUrl),
    );
    const networkResultPromise = completedTrades(networkFetch, secret);
    await vi.runAllTimersAsync();
    const networkResult = await networkResultPromise;

    const rawBody = 'private-upstream-response-body';
    const jsonResult = await completedTrades(sequenceFetch(new Response(rawBody)));
    const serialized = JSON.stringify([networkResult, jsonResult]);

    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain(fullUrl);
    expect(serialized).not.toContain(rawBody);
  });
});
