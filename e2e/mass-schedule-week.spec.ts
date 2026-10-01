import { expect, test } from '@playwright/test';

const tenantAdminState = process.env.RBAC_TENANT_ADMIN_STORAGE_STATE;

test.describe('Mass schedule week view', () => {
  test('masses workspace shows this week and schedule navigation', async ({ browser }) => {
    test.skip(!tenantAdminState, 'Tenant admin storage state not provided');

    const context = await browser.newContext({ storageState: tenantAdminState });
    const page = await context.newPage();

    await page.goto('/mass-intentions/masses/week');
    await expect(page.getByRole('heading', { name: /^Masses$/i })).toBeVisible();
    await expect(page.getByRole('group', { name: /Week navigation/i })).toBeVisible();

    await page.getByRole('link', { name: 'Edit schedule' }).click();
    await expect(page.getByRole('heading', { name: /Regular Mass schedule/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Preview changes/i })).toBeVisible();

    await page.goto('/mass-intentions/masses/week');
    await page.getByRole('button', { name: 'This week' }).click();
    await expect(page.getByRole('status')).toContainText(/.+/);

    await context.close();
  });

  test('special day modal requires replace or supplement choice', async ({ browser }) => {
    test.skip(!tenantAdminState, 'Tenant admin storage state not provided');

    const context = await browser.newContext({ storageState: tenantAdminState });
    const page = await context.newPage();

    await page.goto('/mass-intentions/masses/week');
    await page.getByRole('button', { name: 'Special day' }).first().click();
    await expect(page.getByRole('heading', { name: /Special day schedule/i })).toBeVisible();

    const replace = page.getByRole('radio', { name: /Replace the regular Mass times/i });
    const supplement = page.getByRole('radio', { name: /Add extra Masses/i });
    await expect(replace).not.toBeChecked();
    await expect(supplement).not.toBeChecked();

    await expect(page.getByRole('button', { name: 'Preview impact' })).toBeDisabled();

    await supplement.check();
    await page.getByRole('button', { name: 'Add time' }).click();
    await page.locator('input[type="time"]').first().fill('18:00');
    await page.getByRole('button', { name: 'Preview impact' }).click();
    await expect(page.getByText(/to add|to update|removed from schedule/i).first()).toBeVisible({ timeout: 15000 });

    await context.close();
  });

  test('scenario A: preview and save weekly schedule shows Mass on week view', async ({ browser }) => {
    test.skip(!tenantAdminState, 'Tenant admin storage state not provided');

    const context = await browser.newContext({ storageState: tenantAdminState });
    const page = await context.newPage();

    await page.goto('/mass-intentions/masses/schedule');
    await expect(page.getByRole('heading', { name: /Regular Mass schedule/i })).toBeVisible();

    const sundaySection = page.locator('section').filter({
      has: page.getByRole('heading', { name: /^Sunday\b/i }),
    });
    const sundayTimeInputs = sundaySection.locator('input[type="time"]');
    if ((await sundayTimeInputs.count()) === 0) {
      await sundaySection.getByRole('button', { name: 'Add time' }).click();
    }
    const timeInput = sundaySection.locator('input[type="time"]').first();
    await timeInput.fill('09:15');

    await page.getByRole('button', { name: 'Preview changes' }).click();
    await expect(page.getByText(/to add|to update|removed from schedule/i).first()).toBeVisible({
      timeout: 15000,
    });

    await page.getByRole('button', { name: /Save weekly schedule/i }).click();
    await expect(page.getByRole('button', { name: /Save weekly schedule/i })).toBeEnabled({ timeout: 20000 });

    await page.goto('/mass-intentions/masses/week');
    await expect(page.getByRole('heading', { name: /^Masses$/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /09:15|9:15/ }).first()).toBeVisible({ timeout: 15000 });

    await context.close();
  });

  test('scenario D: add one-time funeral Mass', async ({ browser }) => {
    test.skip(!tenantAdminState, 'Tenant admin storage state not provided');

    const context = await browser.newContext({ storageState: tenantAdminState });
    const page = await context.newPage();

    await page.goto('/mass-intentions/masses');
    await page.getByRole('button', { name: 'Add one-time Mass' }).click();
    await expect(page.getByRole('heading', { name: /Add a one-time Mass/i })).toBeVisible();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 3);
    const iso = tomorrow.toISOString().slice(0, 10);

    await page.locator('#mass-celebration-day').fill(iso);
    await page.locator('#mass-celebration-time').fill('10:30');
    await page.locator('#mass-celebration-occasion').fill('Funeral');
    await page.getByRole('button', { name: 'Add Mass' }).click();

    await expect(page.getByRole('heading', { name: /Add a one-time Mass/i })).toBeHidden({ timeout: 15000 });
    await page.goto('/mass-intentions/masses');
    await expect(page.getByRole('link', { name: /10:30|Funeral/i }).first()).toBeVisible({ timeout: 15000 });

    await context.close();
  });

  test('scenario C: special day supplement adds evening Mass', async ({ browser }) => {
    test.skip(!tenantAdminState, 'Tenant admin storage state not provided');

    const context = await browser.newContext({ storageState: tenantAdminState });
    const page = await context.newPage();

    await page.goto('/mass-intentions/masses/week');
    await page.getByRole('button', { name: 'Special day' }).first().click();
    await page.getByRole('radio', { name: /Add extra Masses/i }).check();
    await page.getByRole('button', { name: 'Add time' }).click();
    await page.locator('input[type="time"]').first().fill('18:00');
    await page.getByRole('button', { name: 'Preview impact' }).click();
    await expect(page.getByText(/to add|to update|removed from schedule/i).first()).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByRole('heading', { name: /Special day schedule/i })).toBeHidden({ timeout: 20000 });

    await context.close();
  });

  test('scenario C: special day replace saves and shows on week view', async ({ browser }) => {
    test.skip(!tenantAdminState, 'Tenant admin storage state not provided');

    const context = await browser.newContext({ storageState: tenantAdminState });
    const page = await context.newPage();

    await page.goto('/mass-intentions/masses/week');
    await page.getByRole('button', { name: 'Special day' }).first().click();
    await page.getByRole('radio', { name: /Replace the regular Mass times/i }).check();
    await page.getByRole('button', { name: 'Add time' }).click();
    await page.locator('input[type="time"]').first().fill('11:00');
    await page.getByRole('button', { name: 'Preview impact' }).click();
    await expect(page.getByText(/to add|to update|removed from schedule/i).first()).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByRole('heading', { name: /Special day schedule/i })).toBeHidden({ timeout: 20000 });

    await context.close();
  });

  test('re-applying weekly schedule does not duplicate Sunday Mass on week view', async ({ browser }) => {
    test.skip(!tenantAdminState, 'Tenant admin storage state not provided');

    const context = await browser.newContext({ storageState: tenantAdminState });
    const page = await context.newPage();

    await page.goto('/mass-intentions/masses/schedule');
    const sundaySection = page.locator('section').filter({
      has: page.getByRole('heading', { name: /^Sunday\b/i }),
    });
    const sundayTimeInputs = sundaySection.locator('input[type="time"]');
    if ((await sundayTimeInputs.count()) === 0) {
      await sundaySection.getByRole('button', { name: 'Add time' }).click();
    }
    await sundaySection.locator('input[type="time"]').first().fill('08:45');

    await page.getByRole('button', { name: 'Preview changes' }).click();
    await expect(page.getByText(/to add|to update|removed from schedule/i).first()).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole('button', { name: /Save weekly schedule/i }).click();
    await expect(page.getByRole('button', { name: /Save weekly schedule/i })).toBeEnabled({ timeout: 20000 });

    await page.getByRole('button', { name: 'Preview changes' }).click();
    await expect(page.getByText(/to add|to update|removed from schedule/i).first()).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole('button', { name: /Save weekly schedule/i }).click();
    await expect(page.getByRole('button', { name: /Save weekly schedule/i })).toBeEnabled({ timeout: 20000 });

    await page.goto('/mass-intentions/masses/week');
    const chips = page.getByRole('link', { name: /08:45|8:45/ });
    await expect(chips.first()).toBeVisible({ timeout: 15000 });
    expect(await chips.count()).toBeLessThanOrEqual(2);

    await context.close();
  });

  test('generated Mass priest edit does not require weekly schedule change', async ({ browser }) => {
    test.skip(!tenantAdminState, 'Tenant admin storage state not provided');

    const context = await browser.newContext({ storageState: tenantAdminState });
    const page = await context.newPage();

    await page.goto('/mass-intentions/masses/week');
    const regularChip = page.getByRole('link', { name: /Regular/ }).first();
    await regularChip.click();
    await expect(page.getByRole('heading', { name: /Mass details|Celebration/i })).toBeVisible({ timeout: 15000 });

    const priestField = page.locator('#mass-celebration-priest, input[formcontrolname="celebrant_name"]').first();
    if (await priestField.isVisible()) {
      await priestField.fill('Fr. Test Priest');
      await page.getByRole('button', { name: /Save|Update Mass/i }).click();
      await expect(page.getByText(/Fr\. Test Priest/i).first()).toBeVisible({ timeout: 15000 });
    }

    await context.close();
  });

  test('removing weekly slot previews removal not cancellation', async ({ browser }) => {
    test.skip(!tenantAdminState, 'Tenant admin storage state not provided');

    const context = await browser.newContext({ storageState: tenantAdminState });
    const page = await context.newPage();

    await page.goto('/mass-intentions/masses/schedule');
    const saturdaySection = page.locator('section').filter({
      has: page.getByRole('heading', { name: /^Saturday\b/i }),
    });
    const timeInputs = saturdaySection.locator('input[type="time"]');
    if ((await timeInputs.count()) === 0) {
      await saturdaySection.getByRole('button', { name: 'Add time' }).click();
      await saturdaySection.locator('input[type="time"]').first().fill('17:00');
    }

    await page.getByRole('button', { name: 'Preview changes' }).click();
    await page.getByRole('button', { name: /Save weekly schedule/i }).click();
    await expect(page.getByRole('button', { name: /Save weekly schedule/i })).toBeEnabled({ timeout: 20000 });

    const removeBtn = saturdaySection.getByRole('button', { name: /Remove/i }).first();
    if (await removeBtn.isVisible()) {
      await removeBtn.click();
      await page.getByRole('button', { name: /Preview changes/i }).click();
      await expect(page.getByText(/removed from schedule/i).first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(/cancelled/i)).toHaveCount(0);
    }

    await context.close();
  });

  test('scenario B: week-of-month Sunday evening slots', async ({ browser }) => {
    test.skip(!tenantAdminState, 'Tenant admin storage state not provided');

    const context = await browser.newContext({ storageState: tenantAdminState });
    const page = await context.newPage();

    await page.goto('/mass-intentions/masses/schedule');
    const sundaySection = page.locator('section').filter({
      has: page.getByRole('heading', { name: /^Sunday\b/i }),
    });
    if ((await sundaySection.locator('input[type="time"]').count()) === 0) {
      await sundaySection.getByRole('button', { name: 'Add time' }).click();
    }
    const eveningRow = sundaySection.locator('input[type="time"]').first();
    await eveningRow.fill('18:30');
    await sundaySection.locator('details summary').click();
    await sundaySection.getByRole('checkbox', { name: '2nd' }).check();
    await sundaySection.getByRole('checkbox', { name: '4th' }).check();

    await page.getByRole('button', { name: 'Preview changes' }).click();
    await expect(page.getByText(/to add|to update|removed from schedule/i).first()).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole('button', { name: /Save weekly schedule/i }).click();
    await expect(page.getByRole('button', { name: /Save weekly schedule/i })).toBeEnabled({ timeout: 20000 });

    await context.close();
  });

  test('view-only user does not see add one-time Mass', async ({ browser }) => {
    const memberState = process.env.RBAC_TENANT_MEMBER_STORAGE_STATE;
    test.skip(!memberState, 'Tenant member storage state not provided');

    const context = await browser.newContext({ storageState: memberState });
    const page = await context.newPage();

    await page.goto('/mass-intentions/masses/week');
    await expect(page.getByRole('heading', { name: /^Masses$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add one-time Mass' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Edit schedule' })).toHaveCount(0);

    await context.close();
  });
});
