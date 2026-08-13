export interface AuctionListing {
  itemId: string;
  unitPrice: number;
}

export class InvalidListingRowError extends Error {
  readonly code = 'invalid_response';

  constructor() {
    super('네오플 등록 매물 응답이 올바르지 않습니다.');
    this.name = 'InvalidListingRowError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function parseListingRows(rows: readonly unknown[], itemId: string): AuctionListing[] {
  return rows.map((row) => {
    if (!isRecord(row)) {
      throw new InvalidListingRowError();
    }

    const { auctionNo, itemId: rowItemId, count, regCount, currentPrice, unitPrice } = row;

    if (
      typeof rowItemId !== 'string' ||
      rowItemId !== itemId ||
      !isPositiveSafeInteger(auctionNo) ||
      !isPositiveSafeInteger(count) ||
      !isPositiveSafeInteger(regCount) ||
      !isPositiveSafeInteger(currentPrice) ||
      !isPositiveSafeInteger(unitPrice) ||
      currentPrice !== unitPrice * count ||
      regCount < count
    ) {
      throw new InvalidListingRowError();
    }

    return { itemId: rowItemId, unitPrice };
  });
}
