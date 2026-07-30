import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import ErrorPage from './error';

test('오류 안내를 표시하고 다시 시도할 수 있다', () => {
  const retry = vi.fn();

  render(<ErrorPage unstable_retry={retry} />);

  expect(
    screen.getByRole('heading', { level: 1, name: '서비스를 불러오지 못했습니다.' }),
  ).toBeDefined();
  expect(
    screen.getByText('일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'),
  ).toBeDefined();

  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

  expect(retry).toHaveBeenCalledOnce();
});
