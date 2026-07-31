import { expect, test } from '@playwright/test';

const tenantAdminState = process.env.RBAC_TENANT_ADMIN_STORAGE_STATE;
const tenantMemberState = process.env.RBAC_TENANT_MEMBER_STORAGE_STATE;
const platformAdminState = process.env.RBAC_PLATFORM_ADMIN_STORAGE_STATE;

test.describe('Tenant RBAC smoke', () => {
  test('platform admin can access roles and permissions screen', async ({ browser }) => {
    test.skip(!platformAdminState, 'RBAC platform admin storage state not provided');
    const context = await browser.newContext({ storageState: platformAdminState });
    const page = await context.newPage();

    await page.goto('/settings/roles-permissions');
    await expect(page).toHaveURL(/\/settings\/roles-permissions/);
    await expect(page.getByText('Roles & Permissions')).toBeVisible();

    await context.close();
  });

  test('tenant admin can access roles and permissions screen', async ({ browser }) => {
    test.skip(!tenantAdminState, 'RBAC tenant admin storage state not provided');
    const context = await browser.newContext({ storageState: tenantAdminState });
    const page = await context.newPage();

    await page.goto('/settings/roles-permissions');
    await expect(page).toHaveURL(/\/settings\/roles-permissions/);
    await expect(page.getByText('Roles & Permissions')).toBeVisible();

    await context.close();
  });

  test('tenant member is blocked from direct roles and permissions route', async ({ browser }) => {
    test.skip(!tenantMemberState, 'RBAC tenant member storage state not provided');
    const context = await browser.newContext({ storageState: tenantMemberState });
    const page = await context.newPage();

    await page.goto('/settings/roles-permissions');
    await expect(page).toHaveURL(/\/dashboard|\/auth\/login/);

    await context.close();
  });
});
