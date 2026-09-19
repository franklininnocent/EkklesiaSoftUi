import { test, expect } from '@playwright/test';

const baseURL = process.env.RBAC_E2E_BASE_URL || 'http://localhost:4200';

test.describe('Forgot password recovery', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('shows forgot password link on login page', async ({ page }) => {
    await page.goto(`${baseURL}/auth/login`);
    await expect(page.getByRole('button', { name: 'Forgot Password?' })).toBeVisible();
  });

  test('submits recovery request and shows generic success message', async ({ page }) => {
    await page.goto(`${baseURL}/auth/login`);
    await page.getByRole('button', { name: 'Forgot Password?' }).click();
    await page.getByLabel('Email address for password recovery').fill('someone@example.com');
    await page.getByRole('button', { name: 'Submit Request' }).click();

    await expect(page.getByText('Request Submitted')).toBeVisible();
    await expect(page.getByText(/password recovery request has been submitted/i)).toBeVisible();
  });
});
