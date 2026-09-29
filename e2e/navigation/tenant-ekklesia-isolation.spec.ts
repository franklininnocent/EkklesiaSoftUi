import { expect, test } from '@playwright/test';
import {
  createPlatformAdminContext,
  createTenantAdminContext,
  skipWithoutPlatformAdmin,
  skipWithoutTenantAdmin,
} from '../helpers/auth-context';

const EKKLESIA_PLATFORM_NAV = ['tenants', 'application-access', 'platform-ministries'];
const SUPPORT_RESOURCE_NAV = ['support-center'];
const PARISH_NAV = ['church-profile', 'families'];

test.describe('Tenant vs Ekklesia navigation isolation', () => {
  test('tenant administrator never sees Ekklesia sidebar items', async ({ browser }) => {
    test.skip(skipWithoutTenantAdmin(), skipWithoutTenantAdmin() || undefined);

    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/dashboard');
    for (const navId of [...EKKLESIA_PLATFORM_NAV, ...SUPPORT_RESOURCE_NAV]) {
      await expect(page.locator(`[data-nav="${navId}"]`)).toHaveCount(0);
    }

    await page.goto('/support');
    await expect(page).not.toHaveURL(/\/support-center/);

    for (const navId of [...EKKLESIA_PLATFORM_NAV, ...SUPPORT_RESOURCE_NAV]) {
      await expect(page.locator(`[data-nav="${navId}"]`)).toHaveCount(0);
    }

    await page.reload();
    for (const navId of [...EKKLESIA_PLATFORM_NAV, ...SUPPORT_RESOURCE_NAV]) {
      await expect(page.locator(`[data-nav="${navId}"]`)).toHaveCount(0);
    }

    await page.goto('/tenants');
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/support-center');
    await expect(page).toHaveURL(/\/dashboard/);

    await context.close();
  });

  test('platform admin sees Ekklesia platform navigation on Support Center without active session', async ({ browser }) => {
    test.skip(skipWithoutPlatformAdmin(), skipWithoutPlatformAdmin() || undefined);

    const context = await createPlatformAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/support-center');
    await expect(page.locator('[data-nav="support-center"]')).toBeVisible();
    await expect(page.locator('[data-nav="tenants"]')).toBeVisible();

    await context.close();
  });

  test('platform admin with active support session keeps Ekklesia nav and hides parish nav', async ({ browser }) => {
    test.skip(skipWithoutPlatformAdmin(), skipWithoutPlatformAdmin() || undefined);

    const context = await createPlatformAdminContext(browser);
    const page = await context.newPage();

    await page.addInitScript(() => {
      localStorage.setItem(
        'ekklesia.support_session',
        JSON.stringify({
          id: 'e2e-support-session',
          status: 'active',
          tenant_id: 1,
          mode: 'standard',
          reason_code: 'diagnosis',
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          tenant: { id: 1, name: 'St. Helena Parish' },
        })
      );
    });

    await page.goto('/dashboard');

    for (const navId of EKKLESIA_PLATFORM_NAV) {
      await expect(page.locator(`[data-nav="${navId}"]`)).toBeVisible();
    }

    await expect(page.locator('[data-nav="support-center"]')).toBeVisible();

    for (const navId of PARISH_NAV) {
      await expect(page.locator(`[data-nav="${navId}"]`)).toHaveCount(0);
    }

    await page.goto('/tenants');
    await expect(page).toHaveURL(/\/tenants/);

    await context.close();
  });
});
