import { expect, test } from '@playwright/test';

import {
  createPlatformAdminContext,
  createTenantAdminContext,
  skipWithoutPlatformAdmin,
  skipWithoutTenantAdmin,
} from '../helpers/auth-context';

test.describe('Tenant 360 details page', () => {
  test('platform admin can open tenant details and see snapshot sections', async ({ browser }) => {
    test.skip(skipWithoutPlatformAdmin(), skipWithoutPlatformAdmin() || undefined);

    const context = await createPlatformAdminContext(browser);
    const page = await context.newPage();

    const listResponse = await page.request.get('/api/tenant/list?per_page=5');
    expect(listResponse.ok()).toBeTruthy();
    const tenants = (await listResponse.json()).data as Array<{ id: number; name: string }>;
    test.skip(!tenants?.length, 'No tenants available for E2E');

    const tenantId = tenants[0].id;
    await page.goto(`/tenants/${tenantId}`);

    await expect(page.getByRole('heading', { name: tenants[0].name })).toBeVisible();
    await expect(page.getByLabel('Tenant KPIs')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Subscription' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Modules' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Users' })).toBeVisible();

    const detailsResponse = await page.request.get(`/api/tenant/${tenantId}/details`);
    expect(detailsResponse.ok()).toBeTruthy();
    const snapshot = (await detailsResponse.json()).data;
    expect(snapshot.identity.id).toBe(tenantId);
    expect(snapshot.subscription).toHaveProperty('status');
    expect(snapshot.subscription).toHaveProperty('access_mode');

    await context.close();
  });

  test('parish user cannot access platform tenant details API', async ({ browser }) => {
    test.skip(skipWithoutTenantAdmin(), skipWithoutTenantAdmin() || undefined);
    test.skip(skipWithoutPlatformAdmin(), skipWithoutPlatformAdmin() || undefined);

    const platformContext = await createPlatformAdminContext(browser);
    const platformPage = await platformContext.newPage();
    const listResponse = await platformPage.request.get('/api/tenant/list?per_page=1');
    const tenantId = ((await listResponse.json()).data as Array<{ id: number }>)[0]?.id;
    await platformContext.close();
    test.skip(!tenantId, 'No tenant for isolation test');

    const parishContext = await createTenantAdminContext(browser);
    const parishPage = await parishContext.newPage();

    const blocked = await parishPage.request.get(`/api/tenant/${tenantId}/details`);
    expect(blocked.status()).toBe(403);

    await parishPage.goto(`/tenants/${tenantId}`);
    await expect(parishPage).toHaveURL(/\/dashboard|\/auth\/login/);

    await parishContext.close();
  });

  test('expired tenant snapshot shows read_only access mode when fixture available', async ({ browser }) => {
    const expiredTenantId = process.env.SUBSCRIPTION_EXPIRED_E2E_TENANT_ID;
    test.skip(!expiredTenantId || skipWithoutPlatformAdmin(), 'Expired tenant or platform admin fixture not available');

    const context = await createPlatformAdminContext(browser);
    const page = await context.newPage();

    const response = await page.request.get(`/api/tenant/${expiredTenantId}/details`);
    expect(response.ok()).toBeTruthy();
    const snapshot = (await response.json()).data;
    expect(snapshot.subscription.status).toBe('EXPIRED');
    expect(snapshot.subscription.access_mode).toBe('read_only');

    await context.close();
  });
});
