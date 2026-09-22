import { test, expect } from '@playwright/test';
import {
  createTenantAdminContext,
  skipWithoutTenantAdmin,
  skipWithoutTenantMember,
} from '../helpers/auth-context';

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

test.describe('Forgot password admin notification', () => {
  test('tenant admin can open recovery request from notification inbox', async ({ browser }) => {
    const memberSkip = skipWithoutTenantMember();
    const adminSkip = skipWithoutTenantAdmin();
    test.skip(!!memberSkip || !!adminSkip, memberSkip || adminSkip || undefined);

    const memberEmail = process.env.RBAC_TENANT_MEMBER_EMAIL;
    test.skip(!memberEmail, 'RBAC_TENANT_MEMBER_EMAIL not provided');

    const guestContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const guestPage = await guestContext.newPage();
    await guestPage.goto(`${baseURL}/auth/login`);
    await guestPage.getByRole('button', { name: 'Forgot Password?' }).click();
    await guestPage.getByLabel('Email address for password recovery').fill(memberEmail!);
    await guestPage.getByRole('button', { name: 'Submit Request' }).click();
    await expect(guestPage.getByText('Request Submitted')).toBeVisible();
    await guestContext.close();

    const adminContext = await createTenantAdminContext(browser);
    const adminPage = await adminContext.newPage();
    await adminPage.goto(`${baseURL}/dashboard`);

    const bell = adminPage.locator('.notification-bell');
    await expect(bell).toBeVisible();
    await bell.click();
    await expect(adminPage.getByRole('dialog', { name: /notifications/i })).toBeVisible();

    const recoveryItem = adminPage
      .getByRole('dialog', { name: /notifications/i })
      .getByText(/forgot password|password recovery/i)
      .first();
    await expect(recoveryItem).toBeVisible({ timeout: 60_000 });
    await recoveryItem.click();

    await expect(adminPage).toHaveURL(/forgot-password-requests/);
    await expect(adminPage.getByText(/password recovery request/i).first()).toBeVisible();
    await expect(adminPage.getByText(memberEmail!, { exact: false })).toBeVisible();
    await expect(adminPage.locator('body')).not.toContainText(/temporary password|otp|reset token/i);

    await adminContext.close();
  });
});
