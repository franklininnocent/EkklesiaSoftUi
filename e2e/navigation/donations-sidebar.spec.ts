import { expect, test } from '@playwright/test';
import {
  createTenantAdminContext,
  skipWithoutTenantAdmin,
} from '../helpers/auth-context';

test.describe('Donations sidebar navigation', () => {
  test('tenant admin sees nested stewardship tree with data-nav root', async ({ browser }) => {
    test.skip(skipWithoutTenantAdmin(), skipWithoutTenantAdmin() || undefined);

    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/donations');
    await expect(page.locator('[data-nav="donations"]')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Stewardship workspaces' })).toBeVisible();

    await context.close();
  });

  test('deep link to campaigns expands projects in sidebar', async ({ browser }) => {
    test.skip(skipWithoutTenantAdmin(), skipWithoutTenantAdmin() || undefined);

    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/donations/campaigns');
    await expect(page).toHaveURL(/\/donations\/campaigns/);
    await expect(page.locator('[data-nav="donations-projects-campaigns"][aria-current="page"]')).toBeVisible();
    await expect(page.locator('#sidebar-nav-donations-projects')).toBeVisible();

    await context.close();
  });

  test('deep link to categories expands configure in sidebar', async ({ browser }) => {
    test.skip(skipWithoutTenantAdmin(), skipWithoutTenantAdmin() || undefined);

    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/donations/categories');
    await expect(page.locator('[data-nav="donations-configure-categories"][aria-current="page"]')).toBeVisible();
    await expect(page.locator('#sidebar-nav-donations-configure')).toBeVisible();

    await context.close();
  });

  test('navigating away clears donations active leaf', async ({ browser }) => {
    test.skip(skipWithoutTenantAdmin(), skipWithoutTenantAdmin() || undefined);

    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/donations/campaigns');
    await expect(page.locator('[data-nav="donations-projects-campaigns"][aria-current="page"]')).toBeVisible();

    await page.goto('/members');
    await expect(page.locator('[data-nav="donations-projects-campaigns"][aria-current="page"]')).toHaveCount(0);
    await expect(page.locator('[data-nav="members"][aria-current="page"]')).toBeVisible();

    await context.close();
  });

  test('opening collect closes the previous projects workspace', async ({ browser }) => {
    test.skip(skipWithoutTenantAdmin(), skipWithoutTenantAdmin() || undefined);

    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/donations/campaigns');
    await expect(page.locator('#sidebar-nav-donations-projects')).toBeVisible();

    await page.locator('[aria-controls="sidebar-nav-donations-collect"]').click();
    await expect(page.locator('#sidebar-nav-donations-collect')).toBeVisible();
    await expect(page.locator('#sidebar-nav-donations-projects')).toHaveCount(0);

    await context.close();
  });

  test('families route does not force donations submenu open', async ({ browser }) => {
    test.skip(skipWithoutTenantAdmin(), skipWithoutTenantAdmin() || undefined);

    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/families');
    await expect(page.locator('[data-nav="families"][aria-current="page"]')).toBeVisible();
    await expect(page.locator('#sidebar-nav-donations-projects')).toHaveCount(0);

    await context.close();
  });
});

test.describe('Module sidebar subtrees', () => {
  test('ministries audit deep link expands ministries subtree', async ({ browser }) => {
    test.skip(skipWithoutTenantAdmin(), skipWithoutTenantAdmin() || undefined);

    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/ministries/audit');
    await expect(page.locator('[data-nav="ministries-audit"][aria-current="page"]')).toBeVisible();
    await expect(page.locator('#sidebar-nav-ministries')).toBeVisible();

    await context.close();
  });

  test('roles permissions tab deep link highlights assign tab', async ({ browser }) => {
    test.skip(skipWithoutTenantAdmin(), skipWithoutTenantAdmin() || undefined);

    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/settings/roles-permissions?tab=assign');
    await expect(page.locator('[data-nav="roles-permissions-assign"][aria-current="page"]')).toBeVisible();

    await context.close();
  });
});
