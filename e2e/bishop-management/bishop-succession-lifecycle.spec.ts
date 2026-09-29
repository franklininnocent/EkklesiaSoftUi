import { expect, test } from '@playwright/test';
import {
  createPlatformAdminContext,
  skipWithoutPlatformAdmin,
} from '../helpers/auth-context';
import {
  appointSuccessorOnDiocesePage,
  expectBishopAbsentFromCurrentFilter,
  expectBishopVisibleInHistoricalFilter,
  filterBishopList,
  openDioceseDetailBySearch,
} from '../helpers/bishop-succession.page';
import {
  createBishopForEditFlow,
  expectBishopVisibleInList,
  openBishopList,
  searchBishops,
} from '../helpers/bishop-list-edit.page';

test.describe('Platform bishop succession lifecycle', () => {
  test.skip(skipWithoutPlatformAdmin(), 'RBAC platform admin storage state not provided');

  test('should retire incumbent, appoint successor, and keep both bishops discoverable', async ({ browser }) => {
    const context = await createPlatformAdminContext(browser);
    const page = await context.newPage();
    const stamp = Date.now();
    const incumbentName = `E2E Incumbent ${stamp}`;
    const successorName = `E2E Successor ${stamp}`;

    await createBishopForEditFlow(page, incumbentName);
    await openBishopList(page);
    await searchBishops(page, incumbentName);
    const incumbentRow = page.getByRole('row', { name: incumbentName });
    await expect(incumbentRow).toBeVisible();

    const dioceseCell = await incumbentRow.locator('td').nth(2).innerText();
    const dioceseName = dioceseCell.trim();
    expect(dioceseName.length).toBeGreaterThan(0);

    await openDioceseDetailBySearch(page, dioceseName);
    await expect(page.getByText(incumbentName)).toBeVisible();
    await appointSuccessorOnDiocesePage(page, successorName);

    await expect(page.getByText(successorName)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Current')).toBeVisible();
    await expect(page.getByText(incumbentName)).toBeVisible();

    await openBishopList(page);
    await searchBishops(page, incumbentName);
    await expectBishopVisibleInList(page, incumbentName);
    await searchBishops(page, successorName);
    await expectBishopVisibleInList(page, successorName);

    await filterBishopList(page, 'Current');
    await searchBishops(page, successorName);
    await expectBishopVisibleInList(page, successorName);
    await expectBishopAbsentFromCurrentFilter(page, incumbentName);

    await expectBishopVisibleInHistoricalFilter(page, incumbentName);

    await openDioceseDetailBySearch(page, dioceseName);
    await expect(page.getByText(successorName)).toBeVisible();
    await expect(page.getByText(incumbentName)).toBeVisible();

    await context.close();
  });
});
