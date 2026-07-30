import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import Page from './page';

test('기반 화면의 서비스 이름과 준비 상태를 표시한다', () => {
  render(<Page />);

  expect(screen.getByRole('heading', { level: 1, name: 'Golgolion' })).toBeDefined();
  expect(screen.getByText(/시세 서비스를 준비하고 있습니다/)).toBeDefined();
});
