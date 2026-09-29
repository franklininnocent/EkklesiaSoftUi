import { expect, test } from '@playwright/test';

import {
  createExpiredTenantAdminContext,
  createPlatformAdminContext,
  skipWithoutPlatformAdmin,
} from '../helpers/auth-context';
import {
  expectSubscriptionReadOnlyContract,
  fetchSubscriptionAccess,
} from '../helpers/subscription-api';
import {
  EXPIRED_BCC_ID,
  expiredTenantId,
  skipWithoutRenewalFixture,
} from '../helpers/subscription-expired';

test.describe.serial('Expired tenant renewal restores write access', () => {
  test('platform renew allows parish mutation without re-login', async ({ browser }) => {
    const skipReason = skipWithoutRenewalFixture();
    test.skip(skipReason, skipReason || undefined);
    test.skip(skipWithoutPlatformAdmin(), skipWithoutPlatformAdmin() || undefined);

    const tenantId = expiredTenantId();
    const parishContext = await createExpiredTenantAdminContext(browser);
    const parishPage = await parishContext.newPage();

    const blocked = await parishPage.request.post('/api/families', {
      data: {
        family_name: 'E2E Pre Renew Blocked',
        head_of_family: 'Blocked',
        bcc_id: EXPIRED_BCC_ID,
        status: 'active',
      },
    });
    await expectSubscriptionReadOnlyContract(blocked);

    const platformContext = await createPlatformAdminContext(browser);
    const platformPage = await platformContext.newPage();
    const renewResponse = await platformPage.request.post(`/api/tenant/${tenantId}/subscription/renew`, {
      data: { duration_months: 12 },
    });
    expect(renewResponse.ok()).toBeTruthy();

    await expect
      .poll(async () => {
        const snapshot = await fetchSubscriptionAccess(parishPage);
        return snapshot.access_mode;
      })
      .toBe('full');

    const allowed = await parishPage.request.post('/api/families', {
      data: {
        family_name: 'E2E Post Renew Family',
        head_of_family: 'Renewed Head',
        bcc_id: EXPIRED_BCC_ID,
        status: 'active',
      },
    });
    expect(allowed.ok()).toBeTruthy();

    const created = await allowed.json();
    const familyId = created?.data?.id;
    if (familyId) {
      await parishPage.request.delete(`/api/families/${familyId}`);
    }

    await platformContext.close();
    await parishContext.close();
  });
});
