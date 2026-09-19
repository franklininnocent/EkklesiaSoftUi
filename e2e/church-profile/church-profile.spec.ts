import { expect, test } from '@playwright/test';
import {
  createTenantAdminContext,
  createTenantMemberContext,
  skipWithoutTenantAdmin,
  skipWithoutTenantMember,
} from '../helpers/auth-context';

test.describe('Church profile navigation', () => {
  test.skip(skipWithoutTenantAdmin(), 'RBAC tenant admin storage state not available');

  test('tenant admin can open church profile from sidebar', async ({ browser }) => {
    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/dashboard');
    await page.getByRole('link', { name: 'Church Profile' }).click();
    await expect(page).toHaveURL(/\/church-profile/);
    await expect(page.getByRole('heading', { name: 'Church Management' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Church Profile' })).toBeVisible();

    await context.close();
  });

  test('social tab deep link highlights sidebar child', async ({ browser }) => {
    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/church-profile?tab=social');
    await expect(page).toHaveURL(/\/church-profile\?tab=social/);
    await expect(page.locator('[data-nav="church-profile-social"][aria-current="page"]')).toBeVisible();
    await expect(page.locator('#sidebar-nav-church-profile')).toBeVisible();

    await context.close();
  });

  test('edit profile action deep link highlights overview child', async ({ browser }) => {
    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/church-profile?tab=profile&action=edit');
    await expect(page).toHaveURL(/\/church-profile\?tab=profile&action=edit/);
    await expect(page.locator('[data-nav="church-profile-edit"][aria-current="page"]')).toBeVisible();
    await expect(page.locator('#sidebar-nav-church-profile-profile')).toBeVisible();

    await context.close();
  });

  test('settings priests card deep-links to leadership tab', async ({ browser }) => {
    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/settings');
    await page.getByText('Priests', { exact: true }).click();
    await expect(page).toHaveURL(/\/church-profile\?tab=leadership/);
    await expect(page.getByRole('heading', { name: 'Current Governance' })).toBeVisible();

    await context.close();
  });
});

test.describe('Church profile leadership', () => {
  test.skip(skipWithoutTenantAdmin(), 'RBAC tenant admin storage state not available');

  test('tenant admin can open leadership governance tab', async ({ browser }) => {
    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/church-profile?tab=leadership');
    await expect(page).toHaveURL(/\/church-profile\?tab=leadership/);
    await expect(page.getByRole('heading', { name: 'Current Governance' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Leader' })).toBeVisible();

    await context.close();
  });

  test('leadership history section is visible', async ({ browser }) => {
    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/church-profile?tab=leadership');
    await expect(page.getByText('Leadership History')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Table' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Timeline' })).toBeVisible();

    await context.close();
  });
});

test.describe('Church profile leadership photo viewer', () => {
  test.skip(skipWithoutTenantAdmin(), 'RBAC tenant admin storage state not available');

  test('opens image viewer from leadership photo when available', async ({ browser }) => {
    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/church-profile?tab=leadership');
    await expect(page.getByRole('heading', { name: 'Current Governance' })).toBeVisible();

    const photoTrigger = page.getByRole('button', { name: /^View photo of / });
    if ((await photoTrigger.count()) === 0) {
      await context.close();
      test.skip(true, 'No leadership photos available in this tenant');
      return;
    }

    await photoTrigger.first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Image preview' })).toBeVisible();
    await expect(page.locator('.cf-image-viewer__image')).toBeVisible();

    const initialZoom = await page.locator('.cf-image-viewer__zoom-label').innerText();
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect(page.locator('.cf-image-viewer__zoom-label')).not.toHaveText(initialZoom);

    await page.getByRole('button', { name: 'Reset zoom to fit' }).click();
    await expect(page.locator('.cf-image-viewer__zoom-label')).toHaveText('Fit');

    await page.getByRole('button', { name: 'Close image viewer' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);

    await context.close();
  });
});

test.describe('Church profile leadership role combobox', () => {
  test.skip(skipWithoutTenantAdmin(), 'RBAC tenant admin storage state not available');

  test('tenant admin can select an existing system role in Add Leader', async ({ browser }) => {
    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/church-profile?tab=leadership');
    await page.getByRole('button', { name: 'Add Leader' }).click();
    await expect(page.getByRole('heading', { name: 'Add Leader' })).toBeVisible();

    await page.locator('#assign_role_id').click();
    await page.getByRole('searchbox', { name: 'Search leadership roles' }).fill('Pastor');
    await page.getByRole('option', { name: 'Pastor' }).click();
    await expect(page.locator('#assign_role_id')).toContainText('Pastor');

    await context.close();
  });

  test('tenant admin can create a custom role without closing Add Leader', async ({ browser }) => {
    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();
    const customRole = `Associate Parish Priest ${Date.now()}`;

    await page.goto('/church-profile?tab=leadership');
    await page.getByRole('button', { name: 'Add Leader' }).click();
    await page.locator('#assign_role_id').click();
    await page.getByRole('searchbox', { name: 'Search leadership roles' }).fill(customRole);
    await page.getByRole('button', { name: new RegExp(`Add "${customRole}" as custom role`) }).click();

    await expect(page.locator('#assign_role_id')).toContainText(customRole);
    await expect(page.getByRole('heading', { name: 'Add Leader' })).toBeVisible();

    await context.close();
  });

  test('duplicate pastor search does not offer create action', async ({ browser }) => {
    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/church-profile?tab=leadership');
    await page.getByRole('button', { name: 'Add Leader' }).click();
    await page.locator('#assign_role_id').click();
    await page.getByRole('searchbox', { name: 'Search leadership roles' }).fill('pastor');

    await expect(page.getByRole('option', { name: 'Pastor' })).toBeVisible();
    await expect(page.getByRole('button', { name: /as custom role/ })).toHaveCount(0);

    await context.close();
  });
});

test.describe('Church profile viewer permissions', () => {
  test.skip(skipWithoutTenantMember(), 'RBAC tenant member storage state not available');

  test('tenant member does not see Add Leader on leadership tab', async ({ browser }) => {
    const context = await createTenantMemberContext(browser);
    const page = await context.newPage();

    await page.goto('/church-profile?tab=leadership');
    await expect(page.getByRole('heading', { name: 'Current Governance' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Leader' })).toHaveCount(0);

    await context.close();
  });
});

test.describe('Church profile status metrics', () => {
  test.skip(skipWithoutTenantAdmin(), 'RBAC tenant admin storage state not available');

  test('shows not available for data-dependent metrics when parish has no members', async ({ browser }) => {
    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/church-profile');
    await expect(page.getByRole('heading', { name: 'Church Status' })).toBeVisible();
    await expect(page.locator('.cp-health-item__value--na').first()).toContainText('Not available');
    await expect(page.locator('.cp-health-list')).not.toContainText('78%');
    await expect(page.locator('.cp-health-list')).not.toContainText('82%');
    await expect(page.locator('.cp-health-list')).not.toContainText('84%');

    await context.close();
  });
});
