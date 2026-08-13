export type NeopleResponseKind = 'sold' | 'listing';

export const NEOPLE_RESPONSE_ROW_LIMIT = {
  sold: 100,
  listing: 400,
} as const;

export class InvalidResponseEnvelopeError extends Error {
  readonly code = 'invalid_response';

  constructor() {
    super('네오플 API 응답이 올바르지 않습니다.');
    this.name = 'InvalidResponseEnvelopeError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseNeopleResponseEnvelope(
  response: unknown,
  kind: NeopleResponseKind,
): unknown[] {
  if (!isRecord(response) || !Array.isArray(response.rows)) {
    throw new InvalidResponseEnvelopeError();
  }

  if (response.rows.length > NEOPLE_RESPONSE_ROW_LIMIT[kind]) {
    throw new InvalidResponseEnvelopeError();
  }

  return response.rows;
}
