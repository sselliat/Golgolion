import { describe, expect, test } from 'vitest';

import {
  InvalidResponseEnvelopeError,
  NEOPLE_RESPONSE_ROW_LIMIT,
  parseNeopleResponseEnvelope,
  type NeopleResponseKind,
} from './neople-client-envelope';

const RESPONSE_KINDS: readonly NeopleResponseKind[] = ['sold', 'listing'];

function expectInvalidResponse(response: unknown, kind: NeopleResponseKind): void {
  expect(() => parseNeopleResponseEnvelope(response, kind)).toThrow(InvalidResponseEnvelopeError);

  try {
    parseNeopleResponseEnvelope(response, kind);
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(InvalidResponseEnvelopeError);
    if (!(error instanceof Error)) return;

    expect('code' in error && error.code).toBe('invalid_response');
    expect(error.message).not.toContain('response-secret');
    expect(String(error.cause)).not.toContain('response-secret');
    expect(JSON.stringify(error)).not.toContain('response-secret');
    return;
  }

  throw new Error('응답이 실패해야 합니다.');
}

describe('네오플 응답 envelope', () => {
  test.for(
    RESPONSE_KINDS.flatMap((kind) =>
      [null, [], 'invalid', {}, { rows: {} }, { rows: null }].map((response) => ({
        kind,
        response,
      })),
    ),
  )('$kind의 최상위 응답 구조가 올바르지 않으면 거부한다', ({ kind, response }) => {
    expectInvalidResponse(response, kind);
  });

  test.for(RESPONSE_KINDS)('$kind의 빈 rows를 빈 배열로 반환한다', (kind) => {
    const rows: unknown[] = [];

    expect(parseNeopleResponseEnvelope({ rows }, kind)).toBe(rows);
  });

  test.for(RESPONSE_KINDS)('$kind의 rows 원소를 검증하거나 변환하지 않는다', (kind) => {
    const rows: unknown[] = [null, 'value', 7, { nested: true }, [1, 2, 3]];

    expect(parseNeopleResponseEnvelope({ rows }, kind)).toBe(rows);
  });

  test.for(
    RESPONSE_KINDS.map((kind) => ({
      kind,
      limit: NEOPLE_RESPONSE_ROW_LIMIT[kind],
    })),
  )('$kind는 최대 $limit행까지 허용하고 초과 응답은 거부한다', ({ kind, limit }) => {
    const rows = Array.from({ length: limit }, (_, index) => ({ index }));

    expect(parseNeopleResponseEnvelope({ rows }, kind)).toHaveLength(limit);
    expectInvalidResponse({ rows: [...rows, { response: 'response-secret' }] }, kind);
  });
});
