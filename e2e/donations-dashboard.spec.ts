import { expect, test } from '@playwright/test';

import { createTenantAdminContext, skipWithoutTenantAdmin } from './helpers/auth-context';

test.describe('Donations dashboard', () => {
  test('shows the snapshot and opens overdue, payments, projects, and quick collect', async ({ browser }) => {
    test.skip(skipWithoutTenantAdmin(), skipWithoutTenantAdmin() || undefined);

    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/donations');
    await expect(page.getByRole('heading', { name: 'Financial Dashboard' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'This month' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Filters' })).toBeVisible();
    await page.getByRole('button', { name: 'Filters' }).click();
    await expect(page.getByRole('dialog')).toContainText('Custom date range');
    await page.getByRole('button', { name: 'Close filters' }).click();
    await expect(page.getByText('Collected this month')).toBeVisible();
    await expect(page.getByText('Same days last month')).toBeVisible();
    await expect(page.getByText('Outstanding contributions')).toBeVisible();
    await expect(page.getByText('Family participation')).toBeVisible();
    await expect(page.getByText('Net Position')).toHaveCount(0);
    await expect(page.getByText('Financial Health Score')).toHaveCount(0);

    await page.getByRole('button', { name: 'Quick Collect' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Close Quick Collect' }).click();

    await page.getByRole('link', { name: 'View all overdue' }).click();
    await expect(page).toHaveURL(/\/donations\/dues\?.*overdue_only=1/);

    await page.goto('/donations');
    await page.getByRole('link', { name: /Collected this month/ }).click();
    await expect(page).toHaveURL(/\/donations\/payments\?.*paid_from=/);

    await page.goto('/donations');
    await page.getByRole('navigation', { name: 'Financial shortcuts' }).getByRole('link', { name: 'Projects' }).click();
    await expect(page).toHaveURL(/\/donations\/projects/);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/donations');
    await expect(page.getByRole('heading', { name: 'Financial Dashboard' })).toBeVisible();
    await expect(page.getByLabel('Financial snapshot')).toBeVisible();

    await context.close();
  });
});
