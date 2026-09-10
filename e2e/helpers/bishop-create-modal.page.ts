import { Page, expect } from '@playwright/test';

export async function openBishopList(page: Page): Promise<void> {
  await page.goto('/settings/ecclesiastical/bishops');
  await expect(page.getByRole('heading', { name: /bishops/i })).toBeVisible({ timeout: 15000 });
}

export async function openCreateBishopModal(page: Page): Promise<void> {
  await openBishopList(page);
  await page.getByRole('button', { name: 'Add Bishop' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Create New Bishop')).toBeVisible();
}

export async function fillValidBishopForm(page: Page, uniqueName: string): Promise<void> {
  await page.locator('#full_name').fill(uniqueName);
  await page.locator('#archdiocese_id').click();
  await page.getByRole('option').first().click();
  await page.locator('#ecclesiastical_title_id').selectOption({ index: 1 });
  await page.locator('#status').selectOption('active');
  await page.locator('#date_of_birth').fill('1955-03-15');
  await page.locator('#ordained_priest_date').fill('1980-06-01');
  await page.locator('#ordained_bishop_date').fill('2005-09-09');
  await page.locator('#appointed_date').fill('2006-01-01');
  await page.locator('#email').fill(`${Date.now()}@bishop-qa.example.com`);
  await page.locator('#phone input, #phone').first().fill('9876543210');
  await page.locator('#photo_url').fill('https://cdn.example.com/bishop.jpg');
  await page.locator('#education').fill('STB, Rome\nMA Theology');
}

export async function submitCreateBishopModal(page: Page): Promise<void> {
  const createResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/ecclesiastical/bishops') &&
      response.request().method() === 'POST'
  );

  await page.getByRole('button', { name: 'Create' }).click();
  await createResponse;
}

export async function expectCreateValidationErrors(page: Page): Promise<void> {
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Create New Bishop')).toBeVisible();
}
