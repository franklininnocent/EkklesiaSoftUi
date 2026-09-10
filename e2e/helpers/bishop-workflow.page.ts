import { expect, Page } from '@playwright/test';

export async function openDiocesanBishopTab(page: Page): Promise<void> {
  await page.goto('/church-profile?tab=diocesan-bishop');
  await expect(page).toHaveURL(/tab=diocesan-bishop/);
  await expect(page.getByRole('button', { name: 'Diocesan Bishop' })).toBeVisible();
}

export async function submitBishopCorrection(
  page: Page,
  bishopName: string,
  notes?: string,
): Promise<void> {
  await page.getByRole('button', { name: 'Suggest New Bishop / Report an Update' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await dialog.getByText('Correct bishop details', { exact: true }).click();
  await dialog.getByRole('button', { name: 'Continue' }).click();

  await dialog.getByPlaceholder('Full name as announced').fill(bishopName);
  if (notes) {
    await dialog.getByPlaceholder('Short note for the reviewer').fill(notes);
  }
  await dialog.getByRole('button', { name: 'Continue' }).click();

  const submitResponse = page.waitForResponse((response) => {
    return response.url().includes('/api/tenant/bishop-updates')
      && response.request().method() === 'POST'
      && response.url().includes('/submit')
      && response.ok();
  });

  await dialog.getByRole('button', { name: 'Send for review' }).click();
  await submitResponse;

  await expect(dialog).toBeHidden({ timeout: 15_000 });
  await expect(page.getByRole('table').getByText('Pending')).toBeVisible({ timeout: 15_000 });
}

export async function submitNewBishopSuggestion(
  page: Page,
  bishopName: string,
  notes?: string,
): Promise<void> {
  await page.getByRole('button', { name: 'Suggest New Bishop / Report an Update' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await dialog.getByText('Suggest new bishop', { exact: true }).click();
  await dialog.getByRole('button', { name: 'Continue' }).click();
  await expect(dialog.getByText('Diocese / Archdiocese')).toBeVisible();

  await dialog.getByPlaceholder('Full name as announced').fill(bishopName);
  await dialog.locator('input[type="date"]').first().fill('2026-03-01');
  const endReason = dialog.locator('select');
  if (await endReason.count()) {
    await endReason.selectOption('retirement');
  }
  if (notes) {
    await dialog.getByPlaceholder('Short note for the reviewer').fill(notes);
  }
  await dialog.getByRole('button', { name: 'Continue' }).click();

  const submitResponse = page.waitForResponse((response) => {
    return response.url().includes('/api/tenant/bishop-updates')
      && response.request().method() === 'POST'
      && response.url().includes('/submit')
      && response.ok();
  });

  await dialog.getByRole('button', { name: 'Send for review' }).click();
  await submitResponse;

  await expect(dialog).toBeHidden({ timeout: 15_000 });
  await expect(page.getByRole('table').getByText('Pending')).toBeVisible({ timeout: 15_000 });
}

export async function openBishopUpdateQueue(page: Page): Promise<void> {
  await page.goto('/settings/ecclesiastical/bishop-updates');
  await expect(page.getByRole('heading', { name: 'Bishop Suggestions' })).toBeVisible();
}

export async function approveQueuedRequest(page: Page, searchText: string): Promise<void> {
  await page.getByRole('button', { name: 'Refresh' }).click();
  const row = page.locator('table tbody tr').filter({ hasText: searchText }).first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.click();

  await expect(page.getByRole('heading', { name: /correct information|new bishop/i })).toBeVisible();

  const approveResponse = page.waitForResponse((response) => {
    return response.url().includes('/api/ecclesiastical/bishop-update-requests/')
      && response.url().includes('/approve')
      && response.request().method() === 'POST'
      && response.ok();
  });

  await page.getByRole('button', { name: 'Approve & apply' }).click();
  await approveResponse;
}

export async function rejectQueuedRequest(page: Page, searchText: string, reason: string): Promise<void> {
  await page.getByRole('button', { name: 'Refresh' }).click();
  const row = page.locator('table tbody tr').filter({ hasText: searchText }).first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.click();

  await page.getByPlaceholder('Reason for rejection…').fill(reason);

  const rejectResponse = page.waitForResponse((response) => {
    return response.url().includes('/api/ecclesiastical/bishop-update-requests/')
      && response.url().includes('/reject')
      && response.request().method() === 'POST'
      && response.ok();
  });

  await page.getByRole('button', { name: 'Reject' }).click();
  await rejectResponse;
}
