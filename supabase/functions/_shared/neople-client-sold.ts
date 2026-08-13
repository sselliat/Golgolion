export interface CompletedTrade {
  soldAt: string;
  itemId: string;
  unitPrice: number;
  quantity: number;
}

export class InvalidSoldRowError extends Error {
  readonly code = 'invalid_response';

  constructor() {
    super('네오플 체결 응답이 올바르지 않습니다.');
    this.name = 'InvalidSoldRowError';
  }
}

const SOLD_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;
const KST_OFFSET_MILLISECONDS = 9 * 60 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function parseSoldDate(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const match = SOLD_DATE_PATTERN.exec(value);
  if (!match) {
    return undefined;
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);

  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) {
    return undefined;
  }

  const calendarDate = new Date(0);
  calendarDate.setUTCFullYear(year, month - 1, day);
  calendarDate.setUTCHours(hour, minute, second, 0);

  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day ||
    calendarDate.getUTCHours() !== hour ||
    calendarDate.getUTCMinutes() !== minute ||
    calendarDate.getUTCSeconds() !== second
  ) {
    return undefined;
  }

  return new Date(calendarDate.getTime() - KST_OFFSET_MILLISECONDS).toISOString();
}

export function parseSoldRows(rows: readonly unknown[], itemId: string): CompletedTrade[] {
  return rows.map((row) => {
    if (!isRecord(row)) {
      throw new InvalidSoldRowError();
    }

    const soldAt = parseSoldDate(row.soldDate);
    const { count, price, unitPrice } = row;

    if (
      soldAt === undefined ||
      typeof row.itemId !== 'string' ||
      row.itemId !== itemId ||
      !isPositiveSafeInteger(count) ||
      !isPositiveSafeInteger(price) ||
      !isPositiveSafeInteger(unitPrice) ||
      price !== unitPrice * count
    ) {
      throw new InvalidSoldRowError();
    }

    return { soldAt, itemId: row.itemId, unitPrice, quantity: count };
  });
}
