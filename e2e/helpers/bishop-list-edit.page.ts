import { Page, expect } from '@playwright/test';

export async function openBishopList(page: Page): Promise<void> {
  await page.goto('/settings/ecclesiastical/bishops');
  await expect(page.getByRole('heading', { name: /bishops/i })).toBeVisible({ timeout: 15000 });
}

export async function searchBishops(page: Page, term: string): Promise<void> {
  const searchInput = page.getByRole('textbox', { name: /quick search bishops/i });
  await searchInput.fill(term);
  await page.waitForResponse(
    (response) =>
      response.url().includes('/api/ecclesiastical/bishops')
      && response.request().method() === 'GET'
      && response.url().includes('search='),
    { timeout: 10000 }
  );
}

export async function openEditBishopModal(page: Page, bishopName: string | RegExp): Promise<void> {
  const row = page.getByRole('row', { name: bishopName });
  await row.getByTitle('Edit').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Edit Bishop')).toBeVisible();
}

export async function submitEditBishopModal(page: Page): Promise<void> {
  const updateResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/ecclesiastical/bishops/')
      && response.request().method() === 'PUT'
  );

  await page.getByRole('button', { name: 'Update' }).click();
  await updateResponse;
}

export async function fillEditEmail(page: Page, email: string): Promise<void> {
  await page.locator('#email').fill(email);
}

export async function fillEditPhone(page: Page, phone: string): Promise<void> {
  await page.locator('#phone input, #phone').first().fill(phone);
}

export async function expectBishopVisibleInList(page: Page, bishopName: string | RegExp): Promise<void> {
  await expect(page.getByText(bishopName)).toBeVisible({ timeout: 15000 });
}

export async function createBishopForEditFlow(page: Page, uniqueName: string): Promise<void> {
  await openBishopList(page);
  await page.getByRole('button', { name: 'Add Bishop' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.locator('#full_name').fill(uniqueName);
  await page.locator('#archdiocese_id').click();
  await page.getByRole('option').first().click();
  await page.locator('#status').selectOption('active');

  const createResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/ecclesiastical/bishops')
      && response.request().method() === 'POST'
  );

  await page.getByRole('button', { name: 'Create' }).click();
  await createResponse;

  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 10000 });
  await expectBishopVisibleInList(page, uniqueName);
}
