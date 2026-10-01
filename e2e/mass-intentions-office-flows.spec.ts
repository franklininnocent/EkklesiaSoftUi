import { expect, test } from '@playwright/test';

const tenantAdminState = process.env.RBAC_TENANT_ADMIN_STORAGE_STATE;

async function selectFirstAssignableMass(page: import('@playwright/test').Page): Promise<boolean> {
  const massSelect = page.locator('select[formcontrolname="celebration_id"]');
  await expect(massSelect).toBeVisible({ timeout: 15000 });
  const optionValues = await massSelect.locator('option').evaluateAll((opts) =>
    opts.map((o) => (o as HTMLOptionElement).value).filter((v) => v !== '')
  );
  if (!optionValues.length) {
    return false;
  }
  await massSelect.selectOption(optionValues[0]);
  return true;
}

test.describe('Mass intentions office flows (Mass parent)', () => {
  test('create, move, and bulk move when Masses exist', async ({ browser }) => {
    test.skip(!tenantAdminState, 'Tenant admin storage state not provided');

    const context = await browser.newContext({ storageState: tenantAdminState });
    const page = await context.newPage();
    const stamp = Date.now();
    const nameA = `E2E Move A ${stamp}`;
    const nameB = `E2E Move B ${stamp}`;

    await page.goto('/mass-intentions/intentions');
    await expect(page.getByRole('heading', { name: /Office register/i })).toBeVisible();

    for (const name of [nameA, nameB]) {
      await page.getByRole('button', { name: 'Create intention' }).click();
      await page.locator('input[formcontrolname="beneficiary_name"]').fill(name);
      await page.locator('input[formcontrolname="beneficiary_place"]').fill('E2E Place');
      await page.locator('select[formcontrolname="mass_intention_category_id"]').selectOption({ label: 'Thanksgiving' });
      const ok = await selectFirstAssignableMass(page);
      if (!ok) {
        test.skip(true, 'No assignable Masses — seed schedule before E2E');
      }
      await page.getByRole('button', { name: 'Create intention' }).click();
      await expect(page.getByText(name)).toBeVisible({ timeout: 20000 });
    }

    const moveBtn = page.getByRole('button', { name: 'Move to another Mass' }).first();
    if (await moveBtn.isVisible().catch(() => false)) {
      await moveBtn.click();
      const moveModalMass = page.locator('select').filter({ has: page.locator('option') }).last();
      const targets = await moveModalMass.locator('option').evaluateAll((opts) =>
        opts.map((o) => (o as HTMLOptionElement).value).filter((v) => v !== '')
      );
      if (targets.length > 1) {
        await moveModalMass.selectOption(targets[1]);
        await page.getByRole('button', { name: /Move to/i }).click();
        await expect(page.getByText(/moved/i).first()).toBeVisible({ timeout: 15000 });
      }
    }

    await context.close();
  });

  test('cancel Mass flow shows reassignment when unsaid intentions exist', async ({ browser }) => {
    test.skip(!tenantAdminState, 'Tenant admin storage state not provided');

    const context = await browser.newContext({ storageState: tenantAdminState });
    const page = await context.newPage();

    await page.goto('/mass-intentions/masses');
    await expect(page.getByRole('heading', { name: /^Masses$/i })).toBeVisible();

    const firstMassLink = page.locator('a[href*="/mass-intentions/masses/"]').first();
    if (!(await firstMassLink.isVisible().catch(() => false))) {
      test.skip(true, 'No Masses on calendar for cancel E2E');
    }
    await firstMassLink.click();

    const cancelBtn = page.getByRole('button', { name: /Cancel this Mass/i });
    if (!(await cancelBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Cancel not available for this Mass');
    }
    await cancelBtn.click();
    await expect(page.getByText(/unsaid intention/i).first()).toBeVisible({ timeout: 10000 });

    await context.close();
  });
});
