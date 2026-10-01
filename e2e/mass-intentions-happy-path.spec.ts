import { expect, test } from '@playwright/test';

const tenantAdminState = process.env.RBAC_TENANT_ADMIN_STORAGE_STATE;

test.describe('Mass intentions office workflow', () => {
  test('create in modal with Mass, view, and close', async ({ browser }) => {
    test.skip(!tenantAdminState, 'Tenant admin storage state not provided');

    const context = await browser.newContext({ storageState: tenantAdminState });
    const page = await context.newPage();

    const unique = `E2E ${Date.now()}`;

    await page.goto('/mass-intentions/intentions');
    await expect(page.getByRole('heading', { name: /Mass intentions/i })).toBeVisible();

    await page.getByRole('button', { name: 'Create intention' }).click();
    await expect(page.getByRole('heading', { name: /New intention/i })).toBeVisible();

    await page.locator('input[formcontrolname="beneficiary_name"]').fill(unique);
    await page.locator('input[formcontrolname="beneficiary_place"]').fill('E2E Test Place');
    await page.locator('select[formcontrolname="mass_intention_category_id"]').selectOption({ label: 'Thanksgiving' });
    await page.locator('textarea[formcontrolname="intention_description"]').fill(
      'Thanksgiving Mass for the family.'
    );

    const massSelect = page.locator('select[formcontrolname="celebration_id"]');
    await expect(massSelect.locator('option')).not.toHaveCount(1, { timeout: 20000 });
    const optionValues = await massSelect.locator('option').evaluateAll((opts) =>
      opts.map((o) => (o as HTMLOptionElement).value).filter((v) => v !== '')
    );
    if (!optionValues.length) {
      test.skip(true, 'No assignable Masses in parish — seed schedule before E2E');
    }
    await massSelect.selectOption(optionValues[0]);

    await page.getByRole('button', { name: 'Create intention' }).click();

    await expect(page.getByText(unique)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Open').first()).toBeVisible();

    await page.getByRole('button', { name: 'View' }).first().click();
    await expect(page.getByRole('heading', { name: unique })).toBeVisible();
    await expect(page.getByText(unique)).toBeVisible();

    await context.close();
  });
});
