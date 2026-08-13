import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, test, vi } from 'vitest';

import auctionDefaultFixture from '../../../docs/validation/neople/fixtures/auction-default.json';
import auctionSoldFixture from '../../../docs/validation/neople/fixtures/auction-sold.json';
import auctionUnitPriceAscFixture from '../../../docs/validation/neople/fixtures/auction-unit-price-asc.json';
import manifest from '../../../docs/validation/neople/fixtures/manifest.json';

import { fetchAuctionListings, fetchCompletedTrades } from './neople-client';

const API_KEY = 'test-only-neople-api-key';
const ITEM_ID = manifest.itemId;
const OTHER_ITEM_ID = '00000000000000000000000000000000';
const ERROR_CODE_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;

const MINIMAL_SOLD_ROW: Readonly<Record<string, unknown>> = {
  soldDate: '2026-07-30 22:50:19',
  itemId: ITEM_ID,
  count: 2,
  price: 200,
  unitPrice: 100,
};

const MINIMAL_LISTING_ROW: Readonly<Record<string, unknown>> = {
  auctionNo: 1,
  itemId: ITEM_ID,
  count: 2,
  regCount: 2,
  currentPrice: 200,
  unitPrice: 100,
};

interface CodedError extends Error {
  code: string;
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function jsonFetch(value: unknown, status = 200) {
  return vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(value, status));
}

async function requestCompletedTrades(fetchImpl: typeof fetch, itemId = ITEM_ID, apiKey = API_KEY) {
  return await fetchCompletedTrades({ apiKey, itemId, fetchImpl });
}

async function requestAuctionListings(fetchImpl: typeof fetch, itemId = ITEM_ID, apiKey = API_KEY) {
  return await fetchAuctionListings({ apiKey, itemId, fetchImpl });
}

const ENDPOINTS = [
  {
    name: '체결 조회',
    request: requestCompletedTrades,
    validRow: MINIMAL_SOLD_ROW,
    expected: {
      soldAt: '2026-07-30T13:50:19.000Z',
      itemId: ITEM_ID,
      quantity: 2,
      unitPrice: 100,
    },
  },
  {
    name: '등록 매물 조회',
    request: requestAuctionListings,
    validRow: MINIMAL_LISTING_ROW,
    expected: { itemId: ITEM_ID, unitPrice: 100 },
  },
] as const;

function isCodedError(value: unknown): value is CodedError {
  return value instanceof Error && 'code' in value && typeof value.code === 'string';
}

async function getFailure(promise: Promise<unknown>): Promise<CodedError> {
  try {
    await promise;
  } catch (error: unknown) {
    if (isCodedError(error)) {
      expect(error.code.length).toBeLessThanOrEqual(64);
      expect(error.code).toMatch(ERROR_CODE_PATTERN);
      return error;
    }
    throw error;
  }
  throw new Error('실패해야 하는 요청이 성공했습니다.');
}

async function expectFailureCode(promise: Promise<unknown>, code: string): Promise<CodedError> {
  const error = await getFailure(promise);
  expect(error.code).toBe(code);
  return error;
}

function omitField(row: Readonly<Record<string, unknown>>, field: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).filter(([name]) => name !== field));
}

function getRequestedUrl(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>) {
  expect(fetchMock).toHaveBeenCalledOnce();
  const call = fetchMock.mock.calls.at(0);
  if (!call) {
    throw new Error('fetch 호출을 찾을 수 없습니다.');
  }
  const [input, init] = call;
  return {
    init,
    url: new URL(input instanceof Request ? input.url : input.toString()),
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('요청 계약과 사전 검증', () => {
  test('체결 조회는 GET 경로와 필수 쿼리 파라미터를 전달한다', async () => {
    const fetchMock = jsonFetch({ rows: [] });

    await requestCompletedTrades(fetchMock);

    const { init, url } = getRequestedUrl(fetchMock);
    expect(init?.method ?? 'GET').toBe('GET');
    expect(url.origin).toBe('https://api.neople.co.kr');
    expect(url.pathname).toBe('/df/auction-sold');
    expect(url.searchParams.get('itemId')).toBe(ITEM_ID);
    expect(url.searchParams.get('limit')).toBe('100');
    expect(url.searchParams.get('apikey')).toBe(API_KEY);
  });

  test('등록 매물 조회는 GET 경로와 필수 쿼리 파라미터를 전달한다', async () => {
    const fetchMock = jsonFetch({ rows: [] });

    await requestAuctionListings(fetchMock);

    const { init, url } = getRequestedUrl(fetchMock);
    expect(init?.method ?? 'GET').toBe('GET');
    expect(url.origin).toBe('https://api.neople.co.kr');
    expect(url.pathname).toBe('/df/auction');
    expect(url.searchParams.get('itemId')).toBe(ITEM_ID);
    expect(url.searchParams.get('limit')).toBe('400');
    expect(url.searchParams.get('sort')).toBe('unitPrice:asc');
    expect(url.searchParams.get('apikey')).toBe(API_KEY);
  });

  test.for(
    ENDPOINTS.flatMap(({ name, request }) =>
      ['', '   '].map((apiKey) => ({ apiKey, name, request })),
    ),
  )('$name는 비어 있는 API 키면 요청 전에 실패한다', async ({ apiKey, request }) => {
    const fetchMock = vi.fn<typeof fetch>();

    await expect(request(fetchMock, ITEM_ID, apiKey)).rejects.toBeInstanceOf(Error);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test.for(
    ENDPOINTS.flatMap(({ name, request }) =>
      [
        { caseName: '빈 문자열', itemId: '' },
        { caseName: '공백 문자열', itemId: '   ' },
        { caseName: '31자리', itemId: 'a'.repeat(31) },
        { caseName: '33자리', itemId: 'a'.repeat(33) },
        { caseName: '대문자 16진수 포함', itemId: `${'a'.repeat(31)}A` },
        { caseName: '16진수가 아닌 문자 포함', itemId: `${'a'.repeat(31)}g` },
      ].map((itemCase) => ({ ...itemCase, name, request })),
    ),
  )('$name는 $caseName itemId면 요청 전에 실패한다', async ({ itemId, request }) => {
    const fetchMock = vi.fn<typeof fetch>();

    await expect(request(fetchMock, itemId)).rejects.toBeInstanceOf(Error);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test.for(ENDPOINTS)('$name는 주입한 fetch만 사용한다', async ({ request }) => {
    const globalFetch = vi.fn<typeof fetch>();
    const injectedFetch = jsonFetch({ rows: [] });
    vi.stubGlobal('fetch', globalFetch);

    await request(injectedFetch);

    expect(injectedFetch).toHaveBeenCalledOnce();
    expect(globalFetch).not.toHaveBeenCalled();
  });
});

describe('정상 응답과 최소 도메인 변환', () => {
  test('체결 fixture를 최소 체결 값으로 변환한다', async () => {
    const fetchMock = jsonFetch(auctionSoldFixture);

    const result = await requestCompletedTrades(fetchMock);

    expect(result).toEqual(
      auctionSoldFixture.rows.map((row) => ({
        soldAt: new Date(`${row.soldDate.replace(' ', 'T')}+09:00`).toISOString(),
        itemId: row.itemId,
        unitPrice: row.unitPrice,
        quantity: row.count,
      })),
    );
    expect(result[0]).toEqual({
      soldAt: '2026-07-30T13:50:19.000Z',
      itemId: ITEM_ID,
      unitPrice: 54_400_000,
      quantity: 1,
    });
  });

  test.for([
    { fixture: auctionDefaultFixture, name: '기본 등록 매물 fixture' },
    { fixture: auctionUnitPriceAscFixture, name: '단가 오름차순 등록 매물 fixture' },
  ])('$name를 최소 등록 매물 값으로 변환한다', async ({ fixture }) => {
    const fetchMock = jsonFetch(fixture);

    const result = await requestAuctionListings(fetchMock);

    expect(result).toEqual(
      fixture.rows.map((row) => ({ itemId: row.itemId, unitPrice: row.unitPrice })),
    );
  });

  test.for(ENDPOINTS)('$name는 빈 rows를 빈 배열로 반환한다', async ({ request }) => {
    await expect(request(jsonFetch({ rows: [] }))).resolves.toEqual([]);
  });

  test.for(ENDPOINTS)(
    '$name는 추가 필드를 허용하고 반환값에서는 제거한다',
    async ({ expected, request, validRow }) => {
      const response = {
        extraTopLevel: 'ignored',
        rows: [{ ...validRow, extraRowField: 'ignored' }],
      };

      await expect(request(jsonFetch(response))).resolves.toEqual([expected]);
    },
  );

  test.for(ENDPOINTS)(
    '$name는 후속 파이프라인에 필요 없는 필드가 없는 최소 행을 허용한다',
    async ({ expected, request, validRow }) => {
      await expect(request(jsonFetch({ rows: [validRow] }))).resolves.toEqual([expected]);
    },
  );

  test('등록 매물은 단가를 재정렬하지 않고 입력 순서대로 변환한다', async () => {
    const rows = [
      { ...MINIMAL_LISTING_ROW, auctionNo: 1, currentPrice: 600, unitPrice: 300 },
      { ...MINIMAL_LISTING_ROW, auctionNo: 2, currentPrice: 200, unitPrice: 100 },
    ];

    await expect(requestAuctionListings(jsonFetch({ rows }))).resolves.toEqual([
      { itemId: ITEM_ID, unitPrice: 300 },
      { itemId: ITEM_ID, unitPrice: 100 },
    ]);
  });
});

describe('응답 구조와 행 수', () => {
  test.for(
    ENDPOINTS.flatMap(({ name, request }) =>
      [
        { caseName: 'null', response: null },
        { caseName: '배열', response: [] },
        { caseName: '문자열', response: 'invalid' },
        { caseName: '빈 객체', response: {} },
        { caseName: '배열이 아닌 rows', response: { rows: {} } },
      ].map((responseCase) => ({ ...responseCase, name, request })),
    ),
  )('$name는 $caseName 응답을 재시도 없이 거부한다', async ({ request, response }) => {
    const fetchMock = jsonFetch(response);

    await expectFailureCode(request(fetchMock), 'invalid_response');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test('체결 행은 100개까지 허용하고 101개를 거부한다', async () => {
    await expect(
      requestCompletedTrades(jsonFetch({ rows: Array(100).fill(MINIMAL_SOLD_ROW) })),
    ).resolves.toHaveLength(100);
    await expectFailureCode(
      requestCompletedTrades(jsonFetch({ rows: Array(101).fill(MINIMAL_SOLD_ROW) })),
      'invalid_response',
    );
  });

  test('등록 매물 행은 400개까지 허용하고 401개를 거부한다', async () => {
    await expect(
      requestAuctionListings(jsonFetch({ rows: Array(400).fill(MINIMAL_LISTING_ROW) })),
    ).resolves.toHaveLength(400);
    await expectFailureCode(
      requestAuctionListings(jsonFetch({ rows: Array(401).fill(MINIMAL_LISTING_ROW) })),
      'invalid_response',
    );
  });

  test.for(ENDPOINTS)(
    '$name는 하나라도 잘못된 행이 있으면 일부 결과를 반환하지 않는다',
    async ({ request, validRow }) => {
      const fetchMock = jsonFetch({ rows: [validRow, { ...validRow, itemId: OTHER_ITEM_ID }] });

      await expectFailureCode(request(fetchMock), 'invalid_response');
      expect(fetchMock).toHaveBeenCalledOnce();
    },
  );
});

describe('행 필드와 값 검증', () => {
  test.for(
    ['soldDate', 'itemId', 'count', 'price', 'unitPrice'].flatMap((field) => [
      { field, name: `${field} 누락`, row: omitField(MINIMAL_SOLD_ROW, field) },
      {
        field,
        name: `${field} 자료형 불일치`,
        row: { ...MINIMAL_SOLD_ROW, [field]: field === 'soldDate' || field === 'itemId' ? 1 : '1' },
      },
    ]),
  )('체결 행의 $name를 거부한다', async ({ row }) => {
    await expectFailureCode(requestCompletedTrades(jsonFetch({ rows: [row] })), 'invalid_response');
  });

  test.for(
    ['auctionNo', 'itemId', 'count', 'regCount', 'currentPrice', 'unitPrice'].flatMap((field) => [
      { field, name: `${field} 누락`, row: omitField(MINIMAL_LISTING_ROW, field) },
      {
        field,
        name: `${field} 자료형 불일치`,
        row: { ...MINIMAL_LISTING_ROW, [field]: field === 'itemId' ? 1 : '1' },
      },
    ]),
  )('등록 매물 행의 $name를 거부한다', async ({ row }) => {
    await expectFailureCode(requestAuctionListings(jsonFetch({ rows: [row] })), 'invalid_response');
  });

  test.for(ENDPOINTS)(
    '$name는 요청과 다른 itemId의 행을 거부한다',
    async ({ request, validRow }) => {
      await expectFailureCode(
        request(jsonFetch({ rows: [{ ...validRow, itemId: OTHER_ITEM_ID }] })),
        'invalid_response',
      );
    },
  );

  test.for(
    ['count', 'price', 'unitPrice'].flatMap((field) =>
      [
        { caseName: '0', value: 0 },
        { caseName: '음수', value: -1 },
        { caseName: '소수', value: 1.5 },
        { caseName: '문자열', value: '1' },
        { caseName: 'safe integer 초과', value: Number.MAX_SAFE_INTEGER + 1 },
      ].map((valueCase) => ({ ...valueCase, field })),
    ),
  )('체결 행의 $field가 $caseName이면 거부한다', async ({ field, value }) => {
    const row = { ...MINIMAL_SOLD_ROW, [field]: value };
    await expectFailureCode(requestCompletedTrades(jsonFetch({ rows: [row] })), 'invalid_response');
  });

  test.for(
    ['auctionNo', 'count', 'regCount', 'currentPrice', 'unitPrice'].flatMap((field) =>
      [
        { caseName: '0', value: 0 },
        { caseName: '음수', value: -1 },
        { caseName: '소수', value: 1.5 },
        { caseName: '문자열', value: '1' },
        { caseName: 'safe integer 초과', value: Number.MAX_SAFE_INTEGER + 1 },
      ].map((valueCase) => ({ ...valueCase, field })),
    ),
  )('등록 매물 행의 $field가 $caseName이면 거부한다', async ({ field, value }) => {
    const row = { ...MINIMAL_LISTING_ROW, [field]: value };
    await expectFailureCode(requestAuctionListings(jsonFetch({ rows: [row] })), 'invalid_response');
  });

  test('체결 가격이 단가와 수량의 곱과 다르면 거부한다', async () => {
    const row = { ...MINIMAL_SOLD_ROW, price: 201 };
    await expectFailureCode(requestCompletedTrades(jsonFetch({ rows: [row] })), 'invalid_response');
  });

  test('등록 매물 현재가가 단가와 수량의 곱과 다르면 거부한다', async () => {
    const row = { ...MINIMAL_LISTING_ROW, currentPrice: 201 };
    await expectFailureCode(requestAuctionListings(jsonFetch({ rows: [row] })), 'invalid_response');
  });

  test.for([
    { name: '등록 수량과 잔여 수량이 같음', regCount: 2 },
    { name: '등록 수량이 잔여 수량보다 큼', regCount: 3 },
  ])('$name이면 등록 매물을 허용한다', async ({ regCount }) => {
    const row = { ...MINIMAL_LISTING_ROW, regCount };
    await expect(requestAuctionListings(jsonFetch({ rows: [row] }))).resolves.toEqual([
      { itemId: ITEM_ID, unitPrice: 100 },
    ]);
  });

  test('등록 수량이 잔여 수량보다 작으면 등록 매물을 거부한다', async () => {
    const row = { ...MINIMAL_LISTING_ROW, count: 2, regCount: 1 };
    await expectFailureCode(requestAuctionListings(jsonFetch({ rows: [row] })), 'invalid_response');
  });

  test('등록 매물에서 사용하지 않는 음수 price는 검증하지 않는다', async () => {
    const row = { ...MINIMAL_LISTING_ROW, price: -1 };
    await expect(requestAuctionListings(jsonFetch({ rows: [row] }))).resolves.toEqual([
      { itemId: ITEM_ID, unitPrice: 100 },
    ]);
  });
});

describe('체결 시각 검증', () => {
  test('윤년 2월 29일을 KST에서 UTC로 변환한다', async () => {
    const row = { ...MINIMAL_SOLD_ROW, soldDate: '2024-02-29 00:00:00' };

    await expect(requestCompletedTrades(jsonFetch({ rows: [row] }))).resolves.toEqual([
      {
        soldAt: '2024-02-28T15:00:00.000Z',
        itemId: ITEM_ID,
        quantity: 2,
        unitPrice: 100,
      },
    ]);
  });

  test.for([
    { name: '자리수가 짧음', value: '2026-7-30 22:50:19' },
    { name: 'T 구분자', value: '2026-07-30T22:50:19' },
    { name: 'Z timezone suffix', value: '2026-07-30 22:50:19Z' },
    { name: 'offset timezone suffix', value: '2026-07-30 22:50:19+09:00' },
    { name: '앞뒤 공백', value: ' 2026-07-30 22:50:19 ' },
  ])('$name 형식의 체결 시각을 거부한다', async ({ value }) => {
    const row = { ...MINIMAL_SOLD_ROW, soldDate: value };
    await expectFailureCode(requestCompletedTrades(jsonFetch({ rows: [row] })), 'invalid_response');
  });

  test.for([
    { name: '평년 2월 29일', value: '2025-02-29 00:00:00' },
    { name: '2월 30일', value: '2026-02-30 00:00:00' },
    { name: '4월 31일', value: '2026-04-31 00:00:00' },
    { name: '0월', value: '2026-00-01 00:00:00' },
    { name: '13월', value: '2026-13-01 00:00:00' },
    { name: '0일', value: '2026-01-00 00:00:00' },
    { name: '24시', value: '2026-01-01 24:00:00' },
    { name: '60분', value: '2026-01-01 00:60:00' },
    { name: '60초', value: '2026-01-01 00:00:60' },
  ])('$name처럼 존재하지 않는 체결 시각을 거부한다', async ({ value }) => {
    const row = { ...MINIMAL_SOLD_ROW, soldDate: value };
    await expectFailureCode(requestCompletedTrades(jsonFetch({ rows: [row] })), 'invalid_response');
  });

  test('실행 환경 timezone과 무관하게 체결 시각을 KST로 해석한다', async () => {
    vi.stubEnv('TZ', 'America/New_York');
    const row = { ...MINIMAL_SOLD_ROW, soldDate: '2026-07-30 22:50:19' };

    const result = await requestCompletedTrades(jsonFetch({ rows: [row] }));

    expect(result[0]?.soldAt).toBe('2026-07-30T13:50:19.000Z');
  });
});

describe('timeout과 재시도', () => {
  test.for(ENDPOINTS)(
    '$name는 매 시도마다 새 timeout을 적용해 10초에 중단한다',
    async ({ request }) => {
      vi.useFakeTimers();
      const signals: AbortSignal[] = [];
      const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (_input, init) => {
        const response = await new Promise<Response>((_resolve, reject) => {
          if (!init?.signal) {
            reject(new Error('AbortSignal이 없습니다.'));
            return;
          }
          signals.push(init.signal);
          init.signal.addEventListener(
            'abort',
            () => reject(new DOMException('요청이 중단되었습니다.', 'AbortError')),
            { once: true },
          );
        });
        return response;
      });
      const failure = getFailure(request(fetchMock));

      await vi.advanceTimersByTimeAsync(9_999);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(signals[0]?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(signals[0]?.aborted).toBe(true);
      await vi.advanceTimersByTimeAsync(249);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(signals[1]).not.toBe(signals[0]);

      await vi.advanceTimersByTimeAsync(10_000);
      expect(signals[1]?.aborted).toBe(true);
      await vi.advanceTimersByTimeAsync(499);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(signals[2]).not.toBe(signals[1]);

      await vi.advanceTimersByTimeAsync(10_000);
      const error = await failure;
      expect(error.code).toBe('timeout');
      expect(fetchMock).toHaveBeenCalledTimes(3);
    },
  );

  test('네트워크 예외가 계속되면 총 3회 호출한다', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new Error('network failure'));
    const failure = expectFailureCode(requestCompletedTrades(fetchMock), 'network');

    await vi.runAllTimersAsync();

    await failure;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test.for([
    { code: 'rate_limit', status: 429 },
    { code: 'upstream_http', status: 500 },
    { code: 'upstream_http', status: 503 },
  ])('HTTP $status가 계속되면 총 3회 호출하고 $code로 실패한다', async ({ code, status }) => {
    vi.useFakeTimers();
    const fetchMock = jsonFetch({ error: 'upstream' }, status);
    const failure = expectFailureCode(requestCompletedTrades(fetchMock), code);

    await vi.runAllTimersAsync();

    await failure;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test.for([
    { name: '네트워크 예외', status: null },
    { name: 'HTTP 429', status: 429 },
    { name: 'HTTP 500', status: 500 },
    { name: 'HTTP 503', status: 503 },
  ])('$name 뒤 성공하면 즉시 결과를 반환한다', async ({ status }) => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>();
    if (status === null) {
      fetchMock.mockRejectedValueOnce(new Error('network failure'));
    } else {
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'busy' }, status));
    }
    fetchMock.mockResolvedValueOnce(jsonResponse({ rows: [] }));
    const result = requestCompletedTrades(fetchMock);

    await vi.advanceTimersByTimeAsync(249);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);

    await expect(result).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('timeout 뒤 성공하면 즉시 결과를 반환한다', async () => {
    vi.useFakeTimers();
    let firstSignal: AbortSignal | undefined;
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async (_input, init) => {
        const response = await new Promise<Response>((_resolve, reject) => {
          if (!init?.signal) {
            reject(new Error('AbortSignal이 없습니다.'));
            return;
          }
          firstSignal = init.signal;
          init.signal.addEventListener(
            'abort',
            () => reject(new DOMException('요청이 중단되었습니다.', 'AbortError')),
            { once: true },
          );
        });
        return response;
      })
      .mockResolvedValueOnce(jsonResponse({ rows: [] }));
    const result = requestCompletedTrades(fetchMock);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(firstSignal?.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(250);

    await expect(result).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('첫 번째 재시도는 250ms 후, 두 번째 재시도는 추가 500ms 후 실행한다', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new Error('network failure'));
    const failure = getFailure(requestCompletedTrades(fetchMock));

    await vi.advanceTimersByTimeAsync(249);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(499);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect((await failure).code).toBe('network');
  });

  test.for([400, 401, 403, 404, 422])(
    'HTTP %s는 한 번만 호출하고 재시도하지 않는다',
    async (status) => {
      const fetchMock = jsonFetch({ error: 'request' }, status);

      await expectFailureCode(requestCompletedTrades(fetchMock), 'non_retryable_http');
      expect(fetchMock).toHaveBeenCalledOnce();
    },
  );

  test('성공 응답의 JSON 파싱 실패는 한 번만 호출하고 invalid_json으로 실패한다', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expectFailureCode(requestCompletedTrades(fetchMock), 'invalid_json');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test('JSON 파싱 후 응답 검증 실패는 한 번만 호출하고 invalid_response로 실패한다', async () => {
    const fetchMock = jsonFetch({ rows: 'invalid' });

    await expectFailureCode(requestCompletedTrades(fetchMock), 'invalid_response');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test.for([
    { code: 'invalid_json', name: 'JSON 파싱 실패', response: new Response('{') },
    { code: 'invalid_response', name: '응답 검증 실패', response: jsonResponse({ rows: null }) },
  ])(
    '재시도 가능한 실패 뒤 $name가 오면 세 번째 요청 없이 $code로 실패한다',
    async ({ code, response }) => {
      vi.useFakeTimers();
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(jsonResponse({ error: 'busy' }, 503))
        .mockResolvedValueOnce(response);
      const failure = expectFailureCode(requestCompletedTrades(fetchMock), code);

      await vi.advanceTimersByTimeAsync(250);

      await failure;
      expect(fetchMock).toHaveBeenCalledTimes(2);
    },
  );
});

describe('오류 계약과 비밀값 비노출', () => {
  test('API 키와 쿼리 문자열이 포함된 전체 URL을 오류에 노출하지 않는다', async () => {
    const fetchMock = jsonFetch({ error: 'unauthorized' }, 401);

    const error = await expectFailureCode(requestCompletedTrades(fetchMock), 'non_retryable_http');
    const exposed = [error.message, String(error.cause), JSON.stringify(error)].join('\n');
    expect(exposed).not.toContain(API_KEY);
    expect(exposed).not.toContain('https://api.neople.co.kr/df/auction-sold?');
  });

  test('HTTP 오류 응답 본문을 오류에 노출하지 않는다', async () => {
    vi.useFakeTimers();
    const secret = 'http-body-secret-sentinel';
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(secret, { status: 500 }));
    const failure = expectFailureCode(requestCompletedTrades(fetchMock), 'upstream_http');

    await vi.runAllTimersAsync();

    const error = await failure;
    const exposed = [error.message, String(error.cause), JSON.stringify(error)].join('\n');
    expect(exposed).not.toContain(secret);
  });

  test('네트워크 예외 원문의 비밀값을 오류에 노출하지 않는다', async () => {
    vi.useFakeTimers();
    const secret = 'network-error-secret-sentinel';
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new Error(secret));
    const failure = expectFailureCode(requestCompletedTrades(fetchMock), 'network');

    await vi.runAllTimersAsync();

    const error = await failure;
    const exposed = [error.message, String(error.cause), JSON.stringify(error)].join('\n');
    expect(exposed).not.toContain(secret);
  });
});

describe('저장소 통합', () => {
  test('.env.example은 공개 접두사나 값 없이 NEOPLE_API_KEY 이름만 제공한다', () => {
    const environmentExample = readFileSync(
      new URL('../../../.env.example', import.meta.url),
      'utf8',
    );

    expect(environmentExample).toMatch(/^NEOPLE_API_KEY=$/m);
    expect(environmentExample).not.toMatch(/^NEOPLE_API_KEY=.+$/m);
    expect(environmentExample).not.toMatch(/^NEXT_PUBLIC_NEOPLE_API_KEY=/m);
  });
});
