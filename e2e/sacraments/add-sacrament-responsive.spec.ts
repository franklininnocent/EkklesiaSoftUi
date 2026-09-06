import { expect, test } from '@playwright/test';
import { SACRAMENT_E2E_ENTRY_URL } from '../fixtures/sacrament-e2e-data';
import { createTenantAdminContext, skipWithoutTenantAdmin } from '../helpers/auth-context';
import { SacramentFormPage } from '../helpers/sacrament-form.page';

test.describe('Add Sacrament — responsive smoke', () => {
  test.skip(skipWithoutTenantAdmin(), 'RBAC tenant admin storage state not provided');

  test('modal, member search, and save remain accessible', async ({ browser }) => {
    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();
    const form = new SacramentFormPage(page);

    await page.goto(SACRAMENT_E2E_ENTRY_URL);
    await expect(page.getByRole('heading', { name: 'Add Sacrament' })).toBeVisible();
    await expect(page.locator('#sacrament-modal-form')).toBeVisible({ timeout: 15000 });

    await form.selectSacramentType(/marriage|matrimony/i);
    await form.selectMarriageBrideSource('member');

    const search = page.getByTestId('member-search-bride');
    await expect(search).toBeVisible();
    await search.fill('E2E');

    await expect(page.getByTestId('save-sacrament')).toBeVisible();
    await expect(page.getByTestId('save-sacrament')).toBeEnabled();

    await context.close();
  });
});
