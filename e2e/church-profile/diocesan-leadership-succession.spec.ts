import { expect, test } from '@playwright/test';
import {
  createPlatformAdminContext,
  createTenantAdminContext,
  skipWithoutPlatformAdmin,
  skipWithoutTenantAdmin,
} from '../helpers/auth-context';
import {
  approveQueuedRequest,
  openBishopUpdateQueue,
  openDiocesanBishopTab,
  submitNewBishopSuggestion,
} from '../helpers/bishop-workflow.page';

test.describe('Diocesan leadership succession on church profile', () => {
  test.skip(skipWithoutTenantAdmin() || skipWithoutPlatformAdmin(), 'RBAC storage states not provided');

  test('approved bishop succession updates diocesan bishop on church profile', async ({ browser }) => {
    const tenantContext = await createTenantAdminContext(browser);
    const tenantPage = await tenantContext.newPage();
    const successorName = `E2E Successor Bishop ${Date.now()}`;

    await openDiocesanBishopTab(tenantPage);
    await submitNewBishopSuggestion(tenantPage, successorName, 'Playwright succession acceptance test');
    await tenantContext.close();

    const platformContext = await createPlatformAdminContext(browser);
    const platformPage = await platformContext.newPage();

    await openBishopUpdateQueue(platformPage);
    await approveQueuedRequest(platformPage, successorName);
    await platformContext.close();

    const verifyContext = await createTenantAdminContext(browser);
    const verifyPage = await verifyContext.newPage();

    await verifyPage.goto('/church-profile');
    await expect(verifyPage.getByText(successorName)).toBeVisible();

    await verifyContext.close();
  });
});
