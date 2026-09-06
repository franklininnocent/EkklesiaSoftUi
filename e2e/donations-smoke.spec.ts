import { expect, test } from '@playwright/test';

const tenantAdminState = process.env.RBAC_TENANT_ADMIN_STORAGE_STATE;

test.describe('Donations smoke', () => {
  test('tenant admin can open financial dashboard', async ({ browser }) => {
    test.skip(!tenantAdminState, 'Tenant admin storage state not provided');
    const context = await browser.newContext({ storageState: tenantAdminState });
    const page = await context.newPage();

    await page.goto('/donations');
    await expect(page).toHaveURL(/\/donations/);
    await expect(page.getByRole('heading', { name: 'Financial Operations Center' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Financial health overview' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Stewardship workspaces' })).toHaveCount(0);

    await context.close();
  });

  test('tenant admin can open payment register with decision strip', async ({ browser }) => {
    test.skip(!tenantAdminState, 'Tenant admin storage state not provided');
    const context = await browser.newContext({ storageState: tenantAdminState });
    const page = await context.newPage();

    await page.goto('/donations/payments');
    await expect(page).toHaveURL(/\/donations\/payments/);
    await expect(page.getByRole('heading', { name: 'Payment Register' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Suggested next step' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Collect Payment' })).toBeVisible();

    await context.close();
  });

  test('tenant admin can open receipts hub', async ({ browser }) => {
    test.skip(!tenantAdminState, 'Tenant admin storage state not provided');
    const context = await browser.newContext({ storageState: tenantAdminState });
    const page = await context.newPage();

    await page.goto('/donations/receipts');
    await expect(page).toHaveURL(/\/donations\/receipts/);
    await expect(page.getByRole('heading', { name: 'Receipts' })).toBeVisible();

    await context.close();
  });

  test('tenant admin can open approvals workspace', async ({ browser }) => {
    test.skip(!tenantAdminState, 'Tenant admin storage state not provided');
    const context = await browser.newContext({ storageState: tenantAdminState });
    const page = await context.newPage();

    await page.goto('/donations/approvals');
    await expect(page).toHaveURL(/\/donations\/approvals/);
    await expect(page.getByRole('heading', { name: 'Approvals' })).toBeVisible();

    await context.close();
  });

  test('tenant admin can open today offerings register', async ({ browser }) => {
    test.skip(!tenantAdminState, 'Tenant admin storage state not provided');
    const context = await browser.newContext({ storageState: tenantAdminState });
    const page = await context.newPage();

    await page.goto('/donations/register');
    await expect(page).toHaveURL(/\/donations\/register/);
    await expect(page.getByRole('heading', { name: "Today's Offerings" })).toBeVisible();

    await context.close();
  });

  test('tenant admin can open collection day mode', async ({ browser }) => {
    test.skip(!tenantAdminState, 'Tenant admin storage state not provided');
    const context = await browser.newContext({ storageState: tenantAdminState });
    const page = await context.newPage();

    await page.goto('/donations/collection-day');
    await expect(page).toHaveURL(/\/donations\/collection-day/);
    await expect(page.getByRole('main', { name: /Collect Payment/i })).toBeVisible();
    await expect(page.getByRole('searchbox', { name: 'Find family' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Stewardship workspaces' })).toHaveCount(0);

    await context.close();
  });

  test('tenant admin can open parish disbursements register', async ({ browser }) => {
    test.skip(!tenantAdminState, 'Tenant admin storage state not provided');
    const context = await browser.newContext({ storageState: tenantAdminState });
    const page = await context.newPage();

    await page.goto('/donations/expenses');
    await expect(page).toHaveURL(/\/donations\/expenses/);
    await expect(page.getByRole('heading', { name: 'Parish Disbursements' })).toBeVisible();

    await context.close();
  });
});
