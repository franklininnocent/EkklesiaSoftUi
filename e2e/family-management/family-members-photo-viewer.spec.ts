import { expect, test } from '@playwright/test';
import { createTenantAdminContext, skipWithoutTenantAdmin } from '../helpers/auth-context';

test.describe('Family and members photo viewer', () => {
  test.skip(skipWithoutTenantAdmin(), 'RBAC tenant admin storage state not available');

  test('opens image viewer from family list head photo when available', async ({ browser }) => {
    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/families');
    await page.waitForLoadState('networkidle');

    const photoTrigger = page.getByRole('button', { name: /^View photo of / });
    if ((await photoTrigger.count()) === 0) {
      await context.close();
      test.skip(true, 'No family head photos available in this tenant');
      return;
    }

    await photoTrigger.first().click();
    await expect(page.getByRole('region', { name: 'Image preview' })).toBeVisible();
    await page.getByRole('button', { name: 'Close image viewer' }).click();
    await expect(page.getByRole('region', { name: 'Image preview' })).toHaveCount(0);

    await context.close();
  });

  test('opens image viewer from members list head photo when available', async ({ browser }) => {
    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/members');
    await page.waitForLoadState('networkidle');

    const photoTrigger = page.getByRole('button', { name: /^View photo of / });
    if ((await photoTrigger.count()) === 0) {
      await context.close();
      test.skip(true, 'No member photos available in this tenant');
      return;
    }

    await photoTrigger.first().click();
    await expect(page.getByRole('region', { name: 'Image preview' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('region', { name: 'Image preview' })).toHaveCount(0);
    await expect(page).toHaveURL(/\/members/);

    await context.close();
  });

  test('opens nested image viewer from member detail modal when available', async ({ browser }) => {
    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/members');
    await page.waitForLoadState('networkidle');

    const firstRow = page.locator('tbody tr').first();
    if ((await firstRow.count()) === 0) {
      await context.close();
      test.skip(true, 'No members available for detail modal e2e');
      return;
    }

    await firstRow.click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const photoTrigger = page.getByRole('button', { name: /^View photo of / });
    if ((await photoTrigger.count()) === 0) {
      await context.close();
      test.skip(true, 'No member photos available in this tenant');
      return;
    }

    await photoTrigger.click();
    await expect(page.getByRole('region', { name: 'Image preview' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('region', { name: 'Image preview' })).toHaveCount(0);
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByRole('button', { name: 'Close member details' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await context.close();
  });
});
