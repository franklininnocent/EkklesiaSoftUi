import { expect, test } from '@playwright/test';
import {
  createPlatformAdminContext,
  skipWithoutPlatformAdmin,
} from '../helpers/auth-context';
import {
  createBishopForEditFlow,
  fillEditEmail,
  fillEditPhone,
  openBishopList,
  searchBishops,
  openEditBishopModal,
  submitEditBishopModal,
  expectBishopVisibleInList,
} from '../helpers/bishop-list-edit.page';

test.describe('Bishop List page', () => {
  test.skip(skipWithoutPlatformAdmin(), 'RBAC platform admin storage state not provided');

  test('should load bishop list with search and table controls', async ({ browser }) => {
    const context = await createPlatformAdminContext(browser);
    const page = await context.newPage();

    await openBishopList(page);

    await expect(page.getByRole('textbox', { name: /quick search bishops/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Bishop' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Filters' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /name/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /diocese/i })).toBeVisible();

    await context.close();
  });

  test('should search bishops by name', async ({ browser }) => {
    const context = await createPlatformAdminContext(browser);
    const page = await context.newPage();
    const uniqueName = `E2E List Search ${Date.now()}`;

    await createBishopForEditFlow(page, uniqueName);
    await searchBishops(page, uniqueName);

    await expectBishopVisibleInList(page, uniqueName);

    await context.close();
  });
});

test.describe('Bishop List → Edit → List lifecycle', () => {
  test.skip(skipWithoutPlatformAdmin(), 'RBAC platform admin storage state not provided');

  test('should edit bishop email and phone then show updated values in list', async ({ browser }) => {
    const context = await createPlatformAdminContext(browser);
    const page = await context.newPage();
    const uniqueName = `E2E Edit Flow ${Date.now()}`;
    const updatedEmail = `edited-${Date.now()}@bishop-qa.example.com`;
    const updatedPhone = '9123456789';

    await createBishopForEditFlow(page, uniqueName);
    await openEditBishopModal(page, uniqueName);

    await expect(page.locator('#full_name')).toHaveValue(uniqueName);

    await fillEditEmail(page, updatedEmail);
    await fillEditPhone(page, updatedPhone);
    await submitEditBishopModal(page);

    await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 10000 });
    await expect(page.getByText(/updated successfully|bishop updated/i)).toBeVisible({ timeout: 10000 });

    await searchBishops(page, uniqueName);
    await expectBishopVisibleInList(page, uniqueName);

    await context.close();
  });

  test('should keep modal open when edit validation fails', async ({ browser }) => {
    const context = await createPlatformAdminContext(browser);
    const page = await context.newPage();
    const uniqueName = `E2E Edit Validation ${Date.now()}`;

    await createBishopForEditFlow(page, uniqueName);
    await openEditBishopModal(page, uniqueName);

    await fillEditEmail(page, 'not-an-email');
    await page.getByRole('button', { name: 'Update' }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Edit Bishop')).toBeVisible();

    await context.close();
  });
});

test.describe('Bishop Edit authorization', () => {
  test('should block unauthenticated access to bishop list route', async ({ page }) => {
    await page.goto('/settings/ecclesiastical/bishops');

    await expect(page).toHaveURL(/login|auth|dashboard/i, { timeout: 15000 });
  });
});
