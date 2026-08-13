export interface NeopleClientInput {
  readonly apiKey: string;
  readonly itemId: string;
}

export const NEOPLE_CLIENT_INPUT_ERROR_CODE = 'invalid_input';

export type NeopleClientInputError = Error & {
  readonly code: typeof NEOPLE_CLIENT_INPUT_ERROR_CODE;
};

class CodedInputError extends Error {
  readonly code = NEOPLE_CLIENT_INPUT_ERROR_CODE;

  constructor() {
    super('네오플 API 요청 입력이 올바르지 않습니다.');
    this.name = 'NeopleClientInputError';
  }
}

function invalidInputError(): NeopleClientInputError {
  return new CodedInputError();
}

export function validateNeopleClientInput<T extends NeopleClientInput>(input: T): T {
  if (typeof input.apiKey !== 'string' || input.apiKey.trim() === '') {
    throw invalidInputError();
  }

  if (typeof input.itemId !== 'string' || !/^[0-9a-f]{32}$/.test(input.itemId)) {
    throw invalidInputError();
  }

  return input;
}
