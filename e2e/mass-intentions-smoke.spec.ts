import { expect, test } from '@playwright/test';

const tenantAdminState = process.env.RBAC_TENANT_ADMIN_STORAGE_STATE;

test.describe('Mass intentions smoke', () => {
  test('tenant admin can open mass intentions home', async ({ browser }) => {
    test.skip(!tenantAdminState, 'Tenant admin storage state not provided');
    const context = await browser.newContext({ storageState: tenantAdminState });
    const page = await context.newPage();

    await page.goto('/mass-intentions');
    await expect(page).toHaveURL(/\/mass-intentions/);
    await expect(page.getByRole('heading', { name: 'Mass intentions' })).toBeVisible();
    await expect(page.getByText('Accepted this month')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Mass intentions' })).toBeVisible();

    await context.close();
  });

  test('tenant admin can open intentions list', async ({ browser }) => {
    test.skip(!tenantAdminState, 'Tenant admin storage state not provided');
    const context = await browser.newContext({ storageState: tenantAdminState });
    const page = await context.newPage();

    await page.goto('/mass-intentions/intentions');
    await expect(page.getByRole('heading', { name: 'Intentions' })).toBeVisible();

    await context.close();
  });

  test('tenant admin can open masses list', async ({ browser }) => {
    test.skip(!tenantAdminState, 'Tenant admin storage state not provided');
    const context = await browser.newContext({ storageState: tenantAdminState });
    const page = await context.newPage();

    await page.goto('/mass-intentions/masses');
    await expect(page.getByRole('heading', { name: 'Masses' })).toBeVisible();

    await context.close();
  });
});
