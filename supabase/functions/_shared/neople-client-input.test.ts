import { describe, expect, test } from 'vitest';

import {
  NEOPLE_CLIENT_INPUT_ERROR_CODE,
  validateNeopleClientInput,
  type NeopleClientInput,
} from './neople-client-input';

const API_KEY = 'test-only-neople-api-key';
const ITEM_ID = '0123456789abcdef0123456789abcdef';
const ERROR_CODE_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;

function expectInvalidInput(input: NeopleClientInput, secret: string): void {
  try {
    validateNeopleClientInput(input);
    throw new Error('입력이 실패해야 합니다.');
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(Error);
    if (!(error instanceof Error)) return;

    const hasMachineReadableCode = 'code' in error && typeof error.code === 'string';
    expect(hasMachineReadableCode).toBe(true);
    if (!hasMachineReadableCode) return;

    expect(error.code).toBe(NEOPLE_CLIENT_INPUT_ERROR_CODE);
    expect(error.code).toMatch(ERROR_CODE_PATTERN);
    expect(error.message).not.toContain(secret);
    const serializedCause =
      typeof error.cause === 'string' ? error.cause : (JSON.stringify(error.cause ?? null) ?? '');
    expect(serializedCause).not.toContain(secret);
    expect(JSON.stringify(error)).not.toContain(secret);
  }
}

describe('validateNeopleClientInput', () => {
  test('유효한 입력을 그대로 반환한다', () => {
    const input = { apiKey: API_KEY, itemId: ITEM_ID, fetchImpl: fetch };

    expect(validateNeopleClientInput(input)).toBe(input);
  });

  test.for(['', ' ', '\t\n'])('API 키가 $input이면 거부한다', (apiKey) => {
    expectInvalidInput({ apiKey, itemId: ITEM_ID }, API_KEY);
  });

  test.for([
    { name: '빈 문자열', itemId: '' },
    { name: '공백 문자열', itemId: ' '.repeat(32) },
    { name: '31자리', itemId: 'a'.repeat(31) },
    { name: '33자리', itemId: 'a'.repeat(33) },
    { name: '대문자 포함', itemId: `${'a'.repeat(31)}A` },
    { name: '16진수가 아닌 문자 포함', itemId: `${'a'.repeat(31)}g` },
  ])('$name itemId를 거부한다', ({ itemId }) => {
    expectInvalidInput({ apiKey: API_KEY, itemId }, API_KEY);
  });

  test('입력 비밀값을 오류에 포함하지 않는다', () => {
    const secret = 'super-secret-item-id';

    expectInvalidInput({ apiKey: API_KEY, itemId: secret }, secret);
  });
});
