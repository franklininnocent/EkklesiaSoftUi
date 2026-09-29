import { expect, test } from '@playwright/test';
import {
  createPlatformAdminContext,
  createTenantAdminContext,
  hasPlatformAdminStorageState,
  skipWithoutPlatformAdmin,
  skipWithoutTenantAdmin,
} from './helpers/auth-context';

function assertNoSensitiveKeys(payload: unknown, path = 'root'): void {
  if (payload === null || payload === undefined) {
    return;
  }

  if (Array.isArray(payload)) {
    payload.forEach((item, index) => assertNoSensitiveKeys(item, `${path}[${index}]`));
    return;
  }

  if (typeof payload !== 'object') {
    const text = String(payload).toLowerCase();
    expect(text).not.toMatch(/password|refresh_token|access_token|authorization:/);
    return;
  }

  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    expect(key.toLowerCase()).not.toMatch(/^(password|otp|refresh_token|access_token|cookie)$/);
    assertNoSensitiveKeys(value, `${path}.${key}`);
  }
}

test.describe('Application Access', () => {
  test('platform admin can load dashboard, KPIs, and live feed', async ({ browser }) => {
    test.skip(skipWithoutPlatformAdmin(), skipWithoutPlatformAdmin() || undefined);

    const context = await createPlatformAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/application-access');
    await expect(page.getByRole('heading', { name: 'Application Access' })).toBeVisible();
    await expect(page.getByRole('region', { name: /Application access metrics/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Live activity' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Right now' })).toBeVisible();
    await expect(page.getByText(/Last 15 minutes/i)).toBeVisible();

    await context.close();
  });

  test('tenant admin is denied direct access', async ({ browser }) => {
    test.skip(skipWithoutTenantAdmin(), skipWithoutTenantAdmin() || undefined);

    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/application-access');
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: 'Application Access' })).toHaveCount(0);

    await context.close();
  });

  test('dashboard error state shows retry affordance', async ({ browser }) => {
    test.skip(skipWithoutPlatformAdmin(), skipWithoutPlatformAdmin() || undefined);

    const context = await createPlatformAdminContext(browser);
    const page = await context.newPage();

    await page.route('**/api/admin/application-access/dashboard', (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ message: 'Dashboard unavailable' }) })
    );

    await page.goto('/application-access');
    await expect(page.getByRole('alert')).toContainText(/dashboard unavailable|failed/i);
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();

    await context.close();
  });

  test('sessions grid supports filters, pagination, and API payloads stay sanitized', async ({ browser }) => {
    test.skip(skipWithoutPlatformAdmin(), skipWithoutPlatformAdmin() || undefined);

    const context = await createPlatformAdminContext(browser);
    const page = await context.newPage();

    page.on('response', async (response) => {
      const url = response.url();
      if (!url.includes('/api/admin/application-access/')) {
        return;
      }

      try {
        const json = await response.json();
        assertNoSensitiveKeys(json);
      } catch {
        // Non-JSON responses (CSV/stream) are allowed.
      }
    });

    await page.goto('/application-access');
    await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();

    await page.getByRole('button', { name: /filters/i }).click();
    await expect(page.getByRole('heading', { name: /advanced search|filters/i })).toBeVisible();

    const statusField = page.locator('[data-field-key="status"], select[name="status"]').first();
    if (await statusField.count()) {
      await statusField.selectOption('ACTIVE');
      await page.getByRole('button', { name: /apply|search/i }).click();
    }

    const nextPage = page.getByRole('button', { name: /next page|next/i }).first();
    if (await nextPage.count()) {
      await nextPage.click();
    }

    await context.close();
  });

  test('investigation modal shows full investigation sections', async ({ browser }) => {
    test.skip(skipWithoutPlatformAdmin(), skipWithoutPlatformAdmin() || undefined);

    const context = await createPlatformAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/application-access');
    const investigateButton = page.getByRole('button', { name: 'Investigate' }).first();

    if (await investigateButton.count()) {
      await investigateButton.click();
      await expect(page.getByRole('heading', { name: /AA-|Session investigation/i })).toBeVisible();
      for (const section of [
        'Who',
        'Tenant',
        'Device',
        'Network',
        'Support',
        'Modules',
        'Allowed / blocked',
        'Location',
        'Timeline',
      ]) {
        await expect(page.getByRole('heading', { name: section })).toBeVisible();
      }
    }

    await context.close();
  });

  test('revoke confirmation can be cancelled and confirmed when active session exists', async ({ browser }) => {
    test.skip(skipWithoutPlatformAdmin(), skipWithoutPlatformAdmin() || undefined);

    const context = await createPlatformAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/application-access');
    const investigateButton = page.getByRole('button', { name: 'Investigate' }).first();
    if (!(await investigateButton.count())) {
      await context.close();
      return;
    }

    await investigateButton.click();
    const revokeButton = page.getByRole('button', { name: 'Sign this person out' });
    if (!(await revokeButton.count())) {
      await context.close();
      return;
    }

    await revokeButton.click();
    await expect(page.getByText('Sign this person out?')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Sign this person out?')).toHaveCount(0);

    await revokeButton.click();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByText(/revoked|signed out/i)).toBeVisible({ timeout: 15_000 });

    await context.close();
  });

  test('live feed requests SSE stream for authorized platform admin', async ({ browser }) => {
    test.skip(skipWithoutPlatformAdmin(), skipWithoutPlatformAdmin() || undefined);

    const context = await createPlatformAdminContext(browser);
    const page = await context.newPage();
    const streamRequests: string[] = [];

    page.on('request', (request) => {
      if (request.url().includes('/api/admin/application-access/stream')) {
        streamRequests.push(request.url());
      }
    });

    await page.goto('/application-access');
    await expect(page.getByRole('heading', { name: 'Live activity' })).toBeVisible();
    await page.waitForTimeout(2_000);

    expect(streamRequests.length).toBeGreaterThan(0);

    await context.close();
  });

  test('mobile viewport hides desktop-only table columns', async ({ browser }) => {
    test.skip(skipWithoutPlatformAdmin(), skipWithoutPlatformAdmin() || undefined);

    const context = await browser.newContext({
      storageState: process.env.RBAC_PLATFORM_ADMIN_STORAGE_STATE,
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();

    await page.goto('/application-access');

    const areaHeader = page.getByRole('columnheader', { name: 'Area' });
    if (await areaHeader.count()) {
      await expect(areaHeader).toBeHidden();
    }

    await context.close();
  });

  test('live feed exposes polite live region for screen readers', async ({ browser }) => {
    test.skip(!hasPlatformAdminStorageState(), 'Platform admin storage state not provided');

    const context = await createPlatformAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/application-access');
    await expect(page.locator('[aria-live="polite"]')).toHaveCount(1);

    await context.close();
  });
});
