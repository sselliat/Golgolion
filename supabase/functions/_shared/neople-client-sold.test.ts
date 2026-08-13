import { describe, expect, test } from 'vitest';

import auctionSoldFixture from '../../../docs/validation/neople/fixtures/auction-sold.json';
import manifest from '../../../docs/validation/neople/fixtures/manifest.json';

import { InvalidSoldRowError, parseSoldRows } from './neople-client-sold';

const ITEM_ID = manifest.itemId;
const MINIMAL_ROW: Readonly<Record<string, unknown>> = {
  soldDate: '2026-07-30 22:50:19',
  itemId: ITEM_ID,
  count: 2,
  price: 200,
  unitPrice: 100,
};

function expectInvalid(rows: readonly unknown[], itemId = ITEM_ID): void {
  let error: unknown;
  try {
    parseSoldRows(rows, itemId);
  } catch (cause: unknown) {
    error = cause;
  }

  expect(error).toBeInstanceOf(InvalidSoldRowError);
  expect(error).toMatchObject({ code: 'invalid_response' });
}

function omitField(row: Readonly<Record<string, unknown>>, field: string) {
  return Object.fromEntries(Object.entries(row).filter(([name]) => name !== field));
}

describe('체결 행 검증과 최소 결과 변환', () => {
  test('정상 fixture를 최소 체결 결과로 변환하고 입력 순서를 유지한다', () => {
    const result = parseSoldRows(auctionSoldFixture.rows, ITEM_ID);

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

  test('최소 행을 허용하고 추가 필드는 결과에서 제거한다', () => {
    expect(parseSoldRows([{ ...MINIMAL_ROW, extra: 'ignored' }], ITEM_ID)).toEqual([
      {
        soldAt: '2026-07-30T13:50:19.000Z',
        itemId: ITEM_ID,
        unitPrice: 100,
        quantity: 2,
      },
    ]);
  });

  test('빈 행 배열을 빈 결과로 반환한다', () => {
    expect(parseSoldRows([], ITEM_ID)).toEqual([]);
  });

  test.for(['soldDate', 'itemId', 'count', 'price', 'unitPrice'])(
    '$field가 누락되면 거부한다',
    (field) => expectInvalid([omitField(MINIMAL_ROW, field)]),
  );

  test.for([
    { field: 'soldDate', value: 1 },
    { field: 'itemId', value: 1 },
    { field: 'count', value: '2' },
    { field: 'price', value: '200' },
    { field: 'unitPrice', value: '100' },
  ])('$field 자료형이 다르면 거부한다', ({ field, value }) => {
    expectInvalid([{ ...MINIMAL_ROW, [field]: value }]);
  });

  test.for(
    ['count', 'price', 'unitPrice'].flatMap((field) => [
      { field, name: '0', value: 0 },
      { field, name: '음수', value: -1 },
      { field, name: '소수', value: 1.5 },
      { field, name: 'safe integer 초과', value: Number.MAX_SAFE_INTEGER + 1 },
    ]),
  )('$field가 $name이면 거부한다', ({ field, value }) => {
    expectInvalid([{ ...MINIMAL_ROW, [field]: value }]);
  });

  test('가격이 단가와 수량의 곱과 다르면 거부한다', () => {
    expectInvalid([{ ...MINIMAL_ROW, price: 201 }]);
  });

  test('요청과 다른 itemId를 거부한다', () => {
    expectInvalid([{ ...MINIMAL_ROW, itemId: '00000000000000000000000000000000' }]);
  });
});

describe('체결 일시의 엄격한 KST 변환', () => {
  test('윤년 2월 29일을 KST에서 UTC로 변환한다', () => {
    expect(parseSoldRows([{ ...MINIMAL_ROW, soldDate: '2024-02-29 00:00:00' }], ITEM_ID)).toEqual([
      {
        soldAt: '2024-02-28T15:00:00.000Z',
        itemId: ITEM_ID,
        unitPrice: 100,
        quantity: 2,
      },
    ]);
  });

  test.for([
    '2026-7-30 22:50:19',
    '2026-07-30T22:50:19',
    '2026-07-30 22:50:19Z',
    '2026-07-30 22:50:19+09:00',
    ' 2026-07-30 22:50:19 ',
  ])('형식이 엄격하지 않은 soldDate를 거부한다', (soldDate) => {
    expectInvalid([{ ...MINIMAL_ROW, soldDate }]);
  });

  test.for([
    '2025-02-29 00:00:00',
    '2026-02-30 00:00:00',
    '2026-04-31 00:00:00',
    '2026-00-01 00:00:00',
    '2026-13-01 00:00:00',
    '2026-01-00 00:00:00',
    '2026-01-01 24:00:00',
    '2026-01-01 00:60:00',
    '2026-01-01 00:00:60',
  ])('존재하지 않는 달력 시각을 거부한다', (soldDate) => {
    expectInvalid([{ ...MINIMAL_ROW, soldDate }]);
  });

  test('실행 환경 timezone과 무관하게 KST를 기준으로 변환한다', () => {
    const originalTimezone = process.env.TZ;
    process.env.TZ = 'America/New_York';

    try {
      expect(parseSoldRows([MINIMAL_ROW], ITEM_ID)[0]?.soldAt).toBe('2026-07-30T13:50:19.000Z');
    } finally {
      if (originalTimezone === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = originalTimezone;
      }
    }
  });
});
