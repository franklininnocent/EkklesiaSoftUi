import { Page, expect } from '@playwright/test';
import { createBishopForEditFlow, openBishopList, searchBishops } from './bishop-list-edit.page';

export async function createBishopWithDiocese(page: Page, uniqueName: string): Promise<void> {
  await createBishopForEditFlow(page, uniqueName);
}

export async function openDioceseDetailBySearch(page: Page, dioceseName: string): Promise<void> {
  await page.goto('/settings/ecclesiastical/dioceses');
  await expect(page.getByRole('heading', { name: /dioceses/i })).toBeVisible({ timeout: 15000 });
  await page.getByRole('textbox', { name: /search/i }).first().fill(dioceseName);
  await page.getByRole('link', { name: dioceseName }).first().click();
  await expect(page.getByRole('heading', { name: dioceseName })).toBeVisible({ timeout: 15000 });
}

export async function appointSuccessorOnDiocesePage(
  page: Page,
  successorName: string,
  effectiveDate = '2026-01-15',
): Promise<void> {
  await page.getByRole('button', { name: 'Appoint Successor' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.locator('#full_name').fill(successorName);
  await page.locator('#effective_date').fill(effectiveDate);
  await page.locator('#end_reason').selectOption('retirement');

  const successionResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/succession/replace-ordinary')
      && response.request().method() === 'POST',
  );

  await page.getByRole('button', { name: 'Appoint Successor' }).click();
  await successionResponse;
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 10000 });
}

export async function filterBishopList(page: Page, tenure: 'All' | 'Current' | 'Historical'): Promise<void> {
  await openBishopList(page);
  await page.getByRole('button', { name: tenure, exact: true }).click();
  await page.waitForResponse(
    (response) =>
      response.url().includes('/api/ecclesiastical/bishops')
      && response.request().method() === 'GET',
    { timeout: 10000 },
  );
}

export async function expectBishopAbsentFromCurrentFilter(page: Page, bishopName: string): Promise<void> {
  await filterBishopList(page, 'Current');
  await searchBishops(page, bishopName);
  await expect(page.getByText(bishopName)).toHaveCount(0);
}

export async function expectBishopVisibleInHistoricalFilter(page: Page, bishopName: string): Promise<void> {
  await filterBishopList(page, 'Historical');
  await searchBishops(page, bishopName);
  await expect(page.getByText(bishopName)).toBeVisible({ timeout: 15000 });
}
