const intentionalCiTypeError: string = 1;

export const APP_ERROR_MESSAGE = {
  TITLE: '서비스를 불러오지 못했습니다.',
  UNEXPECTED: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
} as const;

export const APP_INTERNAL_ERROR_MESSAGE = {
  INVALID_ENVIRONMENT: '환경변수 설정이 올바르지 않습니다.',
} as const;
