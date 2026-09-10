import { expect, test } from '@playwright/test';
import {
  createPlatformAdminContext,
  skipWithoutPlatformAdmin,
} from '../helpers/auth-context';
import {
  expectCreateValidationErrors,
  fillValidBishopForm,
  openCreateBishopModal,
  submitCreateBishopModal,
} from '../helpers/bishop-create-modal.page';

test.describe('Create New Bishop modal', () => {
  test.skip(skipWithoutPlatformAdmin(), 'RBAC platform admin storage state not provided');

  test('should open create modal with expected fields', async ({ browser }) => {
    const context = await createPlatformAdminContext(browser);
    const page = await context.newPage();

    await openCreateBishopModal(page);

    await expect(page.getByLabel(/full name/i)).toBeVisible();
    await expect(page.getByLabel(/religious name/i)).toBeVisible();
    await expect(page.getByLabel(/diocese\/archdiocese/i)).toBeVisible();
    await expect(page.getByLabel(/ecclesiastical title/i)).toBeVisible();
    await expect(page.getByLabel(/^status$/i)).toBeVisible();
    await expect(page.getByText('Currently Serving')).toBeVisible();
    await expect(page.getByLabel(/date of birth/i)).toBeVisible();
    await expect(page.getByLabel(/ordained priest/i)).toBeVisible();
    await expect(page.getByLabel(/ordained bishop/i)).toBeVisible();
    await expect(page.getByLabel(/appointed date/i)).toBeVisible();
    await expect(page.getByLabel(/^email$/i)).toBeVisible();
    await expect(page.getByLabel(/^phone$/i)).toBeVisible();
    await expect(page.getByLabel(/upload bishop photo/i)).toBeVisible();
    await expect(page.getByLabel(/education & qualifications/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();

    await context.close();
  });

  test('should prevent empty submission', async ({ browser }) => {
    const context = await createPlatformAdminContext(browser);
    const page = await context.newPage();

    await openCreateBishopModal(page);
    await page.getByRole('button', { name: 'Create' }).click();

    await expectCreateValidationErrors(page);
    await expect(page.getByText(/required|invalid/i).first()).toBeVisible();

    await context.close();
  });

  test('should create a bishop successfully end-to-end', async ({ browser }) => {
    const context = await createPlatformAdminContext(browser);
    const page = await context.newPage();
    const uniqueName = `E2E Bishop ${Date.now()}`;

    await openCreateBishopModal(page);
    await fillValidBishopForm(page, uniqueName);
    await submitCreateBishopModal(page);

    await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 10000 });
    await expect(page.getByText(uniqueName)).toBeVisible({ timeout: 15000 });

    await context.close();
  });

  test('should keep modal open on invalid email', async ({ browser }) => {
    const context = await createPlatformAdminContext(browser);
    const page = await context.newPage();

    await openCreateBishopModal(page);
    await page.locator('#full_name').fill('Invalid Email Bishop');
    await page.locator('#archdiocese_id').click();
    await page.getByRole('option').first().click();
    await page.locator('#email').fill('not-an-email');
    await page.getByRole('button', { name: 'Create' }).click();

    await expectCreateValidationErrors(page);

    await context.close();
  });

  test('should reset form when reopened after cancel', async ({ browser }) => {
    const context = await createPlatformAdminContext(browser);
    const page = await context.newPage();

    await openCreateBishopModal(page);
    await page.locator('#full_name').fill('Temporary Bishop Name');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.getByRole('button', { name: 'Add Bishop' }).click();
    await expect(page.locator('#full_name')).toHaveValue('');

    await context.close();
  });
});

test.describe('Create New Bishop modal — unauthorized', () => {
  test('tenant users cannot access platform bishop list route', async ({ page }) => {
    await page.goto('/settings/ecclesiastical/bishops');

    await expect(page).toHaveURL(/login|dashboard|unauthorized|403/);
  });
});
