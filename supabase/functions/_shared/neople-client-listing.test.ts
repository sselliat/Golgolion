import { describe, expect, test } from 'vitest';

import auctionDefaultFixture from '../../../docs/validation/neople/fixtures/auction-default.json';
import auctionUnitPriceAscFixture from '../../../docs/validation/neople/fixtures/auction-unit-price-asc.json';
import manifest from '../../../docs/validation/neople/fixtures/manifest.json';

import { InvalidListingRowError, parseListingRows } from './neople-client-listing';

const ITEM_ID = manifest.itemId;
const MINIMAL_ROW: Readonly<Record<string, unknown>> = {
  auctionNo: 1,
  itemId: ITEM_ID,
  count: 2,
  regCount: 2,
  currentPrice: 200,
  unitPrice: 100,
};

function expectInvalid(rows: readonly unknown[], itemId = ITEM_ID): void {
  try {
    parseListingRows(rows, itemId);
    throw new Error('expected an invalid listing row');
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(InvalidListingRowError);
    expect(error).toMatchObject({ code: 'invalid_response' });
  }
}

function omitField(row: Readonly<Record<string, unknown>>, field: string) {
  return Object.fromEntries(Object.entries(row).filter(([name]) => name !== field));
}

describe('등록 매물 행 검증과 최소 결과 변환', () => {
  test.for([
    { name: '기본 등록 매물 fixture', fixture: auctionDefaultFixture },
    { name: '단가 오름차순 등록 매물 fixture', fixture: auctionUnitPriceAscFixture },
  ])('$name를 최소 등록 매물 값으로 변환하고 입력 순서를 유지한다', ({ fixture }) => {
    expect(parseListingRows(fixture.rows, ITEM_ID)).toEqual(
      fixture.rows.map((row) => ({ itemId: row.itemId, unitPrice: row.unitPrice })),
    );
  });

  test('최소 행을 허용하고 사용하지 않는 추가 필드를 검증하지 않는다', () => {
    expect(parseListingRows([{ ...MINIMAL_ROW, price: -1, extra: 'ignored' }], ITEM_ID)).toEqual([
      { itemId: ITEM_ID, unitPrice: 100 },
    ]);
  });

  test('빈 행 배열을 빈 결과로 반환한다', () => {
    expect(parseListingRows([], ITEM_ID)).toEqual([]);
  });

  test('입력 순서를 재정렬하지 않는다', () => {
    const rows = [
      { ...MINIMAL_ROW, auctionNo: 1, currentPrice: 600, unitPrice: 300 },
      { ...MINIMAL_ROW, auctionNo: 2, currentPrice: 200, unitPrice: 100 },
    ];

    expect(parseListingRows(rows, ITEM_ID)).toEqual([
      { itemId: ITEM_ID, unitPrice: 300 },
      { itemId: ITEM_ID, unitPrice: 100 },
    ]);
  });

  test.for(['auctionNo', 'itemId', 'count', 'regCount', 'currentPrice', 'unitPrice'])(
    '$field가 누락되면 거부한다',
    (field) => expectInvalid([omitField(MINIMAL_ROW, field)]),
  );

  test.for([
    { field: 'auctionNo', value: '1' },
    { field: 'itemId', value: 1 },
    { field: 'count', value: '2' },
    { field: 'regCount', value: '2' },
    { field: 'currentPrice', value: '200' },
    { field: 'unitPrice', value: '100' },
  ])('$field 자료형이 다르면 거부한다', ({ field, value }) => {
    expectInvalid([{ ...MINIMAL_ROW, [field]: value }]);
  });

  test.for(
    ['auctionNo', 'count', 'regCount', 'currentPrice', 'unitPrice'].flatMap((field) =>
      [
        { name: '0', value: 0 },
        { name: '음수', value: -1 },
        { name: '소수', value: 1.5 },
        { name: 'safe integer 초과', value: Number.MAX_SAFE_INTEGER + 1 },
      ].map((valueCase) => ({ ...valueCase, field })),
    ),
  )('$field가 $name이면 거부한다', ({ field, value }) => {
    expectInvalid([{ ...MINIMAL_ROW, [field]: value }]);
  });

  test('JavaScript safe integer 최댓값은 허용한다', () => {
    const value = Number.MAX_SAFE_INTEGER;
    expect(
      parseListingRows(
        [
          {
            auctionNo: value,
            itemId: ITEM_ID,
            count: 1,
            regCount: 1,
            currentPrice: value,
            unitPrice: value,
          },
        ],
        ITEM_ID,
      ),
    ).toEqual([{ itemId: ITEM_ID, unitPrice: value }]);
  });

  test('현재가가 단가와 수량의 곱과 다르면 거부한다', () => {
    expectInvalid([{ ...MINIMAL_ROW, currentPrice: 201 }]);
  });

  test('등록 수량이 수량보다 작으면 거부한다', () => {
    expectInvalid([{ ...MINIMAL_ROW, regCount: 1 }]);
  });

  test.for([2, 3])('등록 수량이 수량 이상이면 허용한다', (regCount) => {
    expect(parseListingRows([{ ...MINIMAL_ROW, regCount }], ITEM_ID)).toEqual([
      { itemId: ITEM_ID, unitPrice: 100 },
    ]);
  });

  test('요청과 다른 itemId의 행을 거부한다', () => {
    expectInvalid([{ ...MINIMAL_ROW, itemId: '00000000000000000000000000000000' }]);
  });
});
