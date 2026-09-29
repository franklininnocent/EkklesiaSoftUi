import { expect, test } from '@playwright/test';

const tenantAdminState = process.env.RBAC_TENANT_ADMIN_STORAGE_STATE;

test.describe('Mass intentions office workflow', () => {
  test('create in modal, view, and close', async ({ browser }) => {
    test.skip(!tenantAdminState, 'Tenant admin storage state not provided');

    const context = await browser.newContext({ storageState: tenantAdminState });
    const page = await context.newPage();

    const unique = `E2E ${Date.now()}`;
    const scheduled = new Date();
    scheduled.setDate(scheduled.getDate() + 7);
    const scheduledStr = scheduled.toISOString().slice(0, 10);

    await page.goto('/mass-intentions/intentions');
    await expect(page.getByRole('heading', { name: /Mass intentions/i })).toBeVisible();

    await page.getByRole('button', { name: 'Create intention' }).click();
    await expect(page.getByRole('heading', { name: /New intention/i })).toBeVisible();

    await page.locator('input[formcontrolname="beneficiary_name"]').fill(unique);
    await page.locator('input[formcontrolname="beneficiary_place"]').fill('E2E Test Place');
    await page.locator('select[formcontrolname="mass_intention_category_id"]').selectOption({ label: 'Thanksgiving' });
    await page.locator('textarea[formcontrolname="intention_description"]').fill(
      `Thanksgiving Mass for the family on ${scheduledStr}.`
    );
    await page.locator('input[formcontrolname="requested_date"]').fill(scheduledStr);
    await page.getByRole('button', { name: 'Create intention' }).click();

    await expect(page.getByText(unique)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Open').first()).toBeVisible();

    await page.getByRole('button', { name: 'View' }).first().click();
    await expect(page.getByRole('heading', { name: /Mass intention/i })).toBeVisible();
    await expect(page.getByText(unique)).toBeVisible();

    await context.close();
  });
});
