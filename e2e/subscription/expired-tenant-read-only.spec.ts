import { expect, test } from '@playwright/test';

import {
  createExpiredTenantAdminContext,
  createGraceTenantAdminContext,
  skipWithoutExpiredTenantAdmin,
  skipWithoutGraceTenantAdmin,
} from '../helpers/auth-context';
import {
  expectSubscriptionReadOnlyContract,
  fetchSubscriptionAccess,
} from '../helpers/subscription-api';
import { EXPIRED_BCC_ID, EXPIRED_FAMILY_ID, EXPIRED_FAMILY_NAME } from '../helpers/subscription-expired';

test.describe.serial('Expired tenant read-only subscription', () => {
  test('access snapshot is EXPIRED read_only', async ({ browser }) => {
    test.skip(skipWithoutExpiredTenantAdmin(), skipWithoutExpiredTenantAdmin() || undefined);

    const context = await createExpiredTenantAdminContext(browser);
    const page = await context.newPage();

    const snapshot = await fetchSubscriptionAccess(page);
    expect(snapshot.status).toBe('EXPIRED');
    expect(snapshot.access_mode).toBe('read_only');

    await context.close();
  });

  test('can view families, sacraments, donations, and my subscription', async ({ browser }) => {
    test.skip(skipWithoutExpiredTenantAdmin(), skipWithoutExpiredTenantAdmin() || undefined);

    const context = await createExpiredTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/families');
    await expect(page).toHaveURL(/\/families/);
    await expect(page.getByText(EXPIRED_FAMILY_NAME)).toBeVisible();

    await page.goto(`/families/${EXPIRED_FAMILY_ID}`);
    await expect(page.getByText(EXPIRED_FAMILY_NAME)).toBeVisible();

    await page.goto('/sacraments/register');
    await expect(page).toHaveURL(/\/sacraments\/register/);
    await expect(page.getByRole('heading', { name: 'Parish Sacrament Register' })).toBeVisible();

    await page.goto('/donations');
    await expect(page).toHaveURL(/\/donations/);
    await expect(page.getByRole('heading', { name: 'Financial Operations Center' })).toBeVisible();

    await page.goto('/settings/my-subscription');
    await expect(page).toHaveURL(/\/settings\/my-subscription/);
    await expect(page.getByRole('heading', { name: 'My Subscription' })).toBeVisible();
    await expect(page.getByText('Read-only mode')).toBeVisible();

    await context.close();
  });

  test('mutation controls are disabled or guarded in the UI', async ({ browser }) => {
    test.skip(skipWithoutExpiredTenantAdmin(), skipWithoutExpiredTenantAdmin() || undefined);

    const context = await createExpiredTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/families');
    const addFamily = page.getByRole('button', { name: 'Add new family' });
    await expect(addFamily).toBeDisabled();

    await page.goto('/sacraments/register');
    const addSacrament = page.getByRole('button', { name: 'Add Sacrament' }).first();
    await expect(addSacrament).toBeDisabled();

    await page.goto('/donations/payments');
    const collectPayment = page.getByRole('button', { name: 'Collect Payment' });
    if (await collectPayment.count()) {
      await expect(collectPayment.first()).toBeDisabled();
    }

    await page.goto('/users');
    const addUser = page.getByRole('button', { name: 'Create new user' });
    await expect(addUser).toBeDisabled();

    await page.goto('/families');
    const collectHeader = page.getByRole('button', { name: '+ Collect' });
    if (await collectHeader.count()) {
      await expect(collectHeader).toBeDisabled();
    }

    await context.close();
  });

  test('direct API mutation is blocked with SUBSCRIPTION_READ_ONLY contract', async ({ browser }) => {
    test.skip(skipWithoutExpiredTenantAdmin(), skipWithoutExpiredTenantAdmin() || undefined);

    const context = await createExpiredTenantAdminContext(browser);
    const page = await context.newPage();

    const listResponse = await page.request.get('/api/families');
    expect(listResponse.ok()).toBeTruthy();

    const createResponse = await page.request.post('/api/families', {
      data: {
        family_name: 'E2E Blocked Family',
        head_of_family: 'Blocked Head',
        bcc_id: EXPIRED_BCC_ID,
        status: 'active',
      },
    });
    await expectSubscriptionReadOnlyContract(createResponse);

    const donationsGet = await page.request.get('/api/tenant/donations/categories');
    expect(donationsGet.ok()).toBeTruthy();

    const ministriesGet = await page.request.get('/api/tenant/ministries/categories');
    expect(ministriesGet.status()).toBe(403);
    const ministriesBody = await ministriesGet.json();
    expect(ministriesBody.reason).toBe('feature_not_entitled');

    await context.close();
  });
});

test.describe('Grace period tenant remains writable', () => {
  test('grace tenant snapshot is GRACE_PERIOD with full access', async ({ browser }) => {
    test.skip(skipWithoutGraceTenantAdmin(), skipWithoutGraceTenantAdmin() || undefined);

    const context = await createGraceTenantAdminContext(browser);
    const page = await context.newPage();

    const snapshot = await fetchSubscriptionAccess(page);
    expect(snapshot.status).toBe('GRACE_PERIOD');
    expect(snapshot.access_mode).toBe('full');

    const createResponse = await page.request.post('/api/families', {
      data: {
        family_name: 'E2E Grace Writable Family',
        head_of_family: 'Grace Head',
        bcc_id: null,
        status: 'active',
      },
    });

    expect(createResponse.status()).not.toBe(403);
    const body = await createResponse.json().catch(() => ({}));
    expect(body.code).not.toBe('SUBSCRIPTION_READ_ONLY');

    await context.close();
  });
});
