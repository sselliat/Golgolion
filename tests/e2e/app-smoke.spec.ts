import { expect, test } from '@playwright/test';

test('홈 화면을 불러온다', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/Golgolion/);
  await expect(page.getByRole('heading', { level: 1, name: 'Golgolion' })).toBeVisible();
  await expect(page.getByText(/시세 서비스를 준비하고 있습니다/)).toBeVisible();
});
