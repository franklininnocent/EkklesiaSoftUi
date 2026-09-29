import { expect, test } from '@playwright/test';
import {
  createPlatformAdminContext,
  createTenantAdminContext,
  createTenantMemberContext,
  hasPlatformAdminStorageState,
  hasTenantAdminStorageState,
  skipWithoutPlatformAdmin,
  skipWithoutTenantAdmin,
  skipWithoutTenantMember,
} from '../helpers/auth-context';
import {
  approveQueuedRequest,
  openBishopUpdateQueue,
  openDiocesanBishopTab,
  rejectQueuedRequest,
  submitBishopCorrection,
  submitNewBishopSuggestion,
} from '../helpers/bishop-workflow.page';

test.describe('Church diocesan bishop tab', () => {
  test.skip(skipWithoutTenantAdmin(), 'RBAC tenant admin storage state not provided');

  test('tenant admin can view diocesan leadership and open report wizard', async ({ browser }) => {
    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await openDiocesanBishopTab(page);
    await expect(page.getByRole('heading', { name: 'Diocesan Bishop', level: 1 })).toBeVisible();
    await expect(page.getByText('E2E Bishop Current').or(page.getByText('Seat vacant'))).toBeVisible();

    await page.getByRole('button', { name: 'Suggest New Bishop / Report an Update' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('What needs updating?')).toBeVisible();

    await context.close();
  });

  test('tenant admin can open suggest new bishop with diocese shown', async ({ browser }) => {
    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await openDiocesanBishopTab(page);
    await page.getByRole('button', { name: 'Suggest New Bishop / Report an Update' }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByText('Suggest new bishop', { exact: true }).click();
    await dialog.getByRole('button', { name: 'Continue' }).click();
    await expect(dialog.getByText('Diocese / Archdiocese')).toBeVisible();
    await expect(dialog.getByPlaceholder('Full name as announced')).toBeVisible();

    await context.close();
  });

  test('tenant admin can submit a bishop correction request', async ({ browser }) => {
    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();
    const proposedName = `E2E Corrected Bishop ${Date.now()}`;

    await openDiocesanBishopTab(page);
    await submitBishopCorrection(page, proposedName, 'Playwright correction smoke test');

    await expect(page.getByRole('table').getByText(/Correct information/i)).toBeVisible();
    await expect(page.getByRole('table').getByText('Pending')).toBeVisible();

    await context.close();
  });
});

test.describe('Church diocesan bishop permissions', () => {
  test.skip(skipWithoutTenantMember(), 'RBAC tenant member storage state not provided');

  test('tenant member without bishop permissions does not see diocesan bishop tab', async ({ browser }) => {
    const context = await createTenantMemberContext(browser);
    const page = await context.newPage();

    await page.goto('/church-profile');
    await expect(page.getByRole('button', { name: 'Diocesan Bishop' })).toHaveCount(0);

    await context.close();
  });
});

test.describe('Platform bishop update queue', () => {
  test.skip(skipWithoutPlatformAdmin(), 'RBAC platform admin storage state not provided');

  test('platform admin can open bishop update review queue', async ({ browser }) => {
    const context = await createPlatformAdminContext(browser);
    const page = await context.newPage();

    await openBishopUpdateQueue(page);
    await expect(page.getByText('Churches never edit bishop master data directly')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();

    await context.close();
  });
});

test.describe('Bishop update end-to-end workflow', () => {
  const skipReason = (): string | false => {
    if (!hasTenantAdminStorageState()) {
      return 'RBAC tenant admin storage state not provided';
    }
    if (!hasPlatformAdminStorageState()) {
      return 'RBAC platform admin storage state not provided';
    }

    return false;
  };

  test.skip(skipReason(), 'Both tenant admin and platform admin storage states are required');

  test('church submits correction and platform admin approves it', async ({ browser }) => {
    const proposedName = `E2E Workflow Bishop ${Date.now()}`;
    const churchContext = await createTenantAdminContext(browser);
    const adminContext = await createPlatformAdminContext(browser);
    const churchPage = await churchContext.newPage();
    const adminPage = await adminContext.newPage();

    await openDiocesanBishopTab(churchPage);
    await submitBishopCorrection(churchPage, proposedName, 'Playwright full workflow test');

    await openBishopUpdateQueue(adminPage);
    await adminPage.locator('select.cf-input').selectOption({ label: 'Submitted' });
    await approveQueuedRequest(adminPage, proposedName);

    await expect(adminPage.getByText('Approved').or(adminPage.getByText('Applied'))).toBeVisible({
      timeout: 15_000,
    });

    await churchContext.close();
    await adminContext.close();
  });

  test('church submits a new bishop suggestion and platform admin rejects it', async ({ browser }) => {
    const proposedName = `E2E Suggested Bishop ${Date.now()}`;
    const rejectionReason = 'Could not verify this announcement.';
    const churchContext = await createTenantAdminContext(browser);
    const adminContext = await createPlatformAdminContext(browser);
    const churchPage = await churchContext.newPage();
    const adminPage = await adminContext.newPage();

    await openDiocesanBishopTab(churchPage);
    await submitNewBishopSuggestion(churchPage, proposedName);

    await openBishopUpdateQueue(adminPage);
    await rejectQueuedRequest(adminPage, proposedName, rejectionReason);
    await expect(adminPage.getByText('Rejected')).toBeVisible({ timeout: 15_000 });

    await openDiocesanBishopTab(churchPage);
    await expect(churchPage.getByRole('table').getByText('Rejected')).toBeVisible({ timeout: 15_000 });
    await expect(churchPage.getByText(rejectionReason)).toBeVisible();
    await expect(churchPage.getByText('E2E Bishop Current').or(churchPage.getByText('Seat vacant'))).toBeVisible();

    await churchContext.close();
    await adminContext.close();
  });
});
