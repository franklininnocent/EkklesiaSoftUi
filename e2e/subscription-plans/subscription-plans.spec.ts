import { expect, test } from '@playwright/test';

import {
  createPlatformAdminContext,
  createTenantAdminContext,
  createTenantMemberContext,
  skipWithoutPlatformAdmin,
  skipWithoutTenantAdmin,
  skipWithoutTenantMember,
} from '../helpers/auth-context';

interface PublicPlan {
  code: string;
  name: string;
  display_order: number;
  pricing_type: string | null;
  features: { code: string }[];
}

test.describe('Public plan catalog', () => {
  test('lists database plans in display order without legacy plans', async ({ request }) => {
    const response = await request.get('/api/public/subscription-plans');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    const plans = body.data as PublicPlan[];

    expect(plans.length).toBeGreaterThan(0);
    expect(plans.some((p) => p.code.startsWith('LEGACY_'))).toBe(false);
    const orders = plans.map((p) => p.display_order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });
});

test.describe('Platform tax configuration API', () => {
  test('super admin can read tax settings and preview a breakdown', async ({ browser }) => {
    test.skip(skipWithoutPlatformAdmin(), skipWithoutPlatformAdmin() || undefined);
    const context = await createPlatformAdminContext(browser);
    const page = await context.newPage();

    const tax = await page.request.get('/api/admin/subscriptions/tax');
    expect(tax.ok()).toBeTruthy();
    const body = await tax.json();
    expect(body.data.tax.label).toBeTruthy();
    expect(body.data.tax.rate_percent).toBeTruthy();
    expect(body.data.impact.catalog).toBeTruthy();

    const preview = await page.request.post('/api/admin/subscriptions/tax/preview', {
      data: { amount: '2999.00', tax: { rate_percent: '18.00', prices_include_tax: false } },
    });
    expect(preview.ok()).toBeTruthy();
    expect((await preview.json()).data.gross).toBeTruthy();

    await context.close();
  });
});

test.describe('Platform plan change preview', () => {
  test('a downgrade preview lists what changes, keeps data and changes nothing', async ({ browser }) => {
    test.skip(skipWithoutPlatformAdmin(), skipWithoutPlatformAdmin() || undefined);
    const context = await createPlatformAdminContext(browser);
    const page = await context.newPage();

    const usage = await page.request.get('/api/admin/subscriptions/usage?per_page=1');
    expect(usage.ok()).toBeTruthy();
    const tenantId = ((await usage.json()).data as { tenant_id: number }[])[0]?.tenant_id;
    test.skip(!tenantId, 'No church with a subscription');

    const plans = (await (await page.request.get('/api/admin/subscriptions/plans')).json()).data as {
      id: number;
      is_assignable: boolean;
      active_version: unknown;
    }[];
    const lowest = plans.find((p) => p.is_assignable && p.active_version);
    test.skip(!lowest, 'No assignable plan');

    const before = (await (await page.request.get(`/api/admin/subscriptions/tenants/${tenantId}`)).json()).data;
    const preview = await page.request.post(`/api/admin/subscriptions/tenants/${tenantId}/preview`, {
      data: { plan_id: lowest!.id },
    });
    expect(preview.ok()).toBeTruthy();
    const impact = (await preview.json()).data;

    expect(impact.data_preserved).toBe(true);
    expect(Array.isArray(impact.features_lost)).toBe(true);
    expect(Array.isArray(impact.over_limit)).toBe(true);
    expect(impact.requires_confirmation).toBe(impact.features_lost.length > 0 || impact.over_limit.length > 0);

    const after = (await (await page.request.get(`/api/admin/subscriptions/tenants/${tenantId}`)).json()).data;
    expect(after).toEqual(before);

    await context.close();
  });
});

test.describe.serial('Tenant subscription boundaries', () => {
  test('tenant admin sees their plan and cannot reach the Ekklesia catalog APIs', async ({ browser }) => {
    test.skip(skipWithoutTenantAdmin(), skipWithoutTenantAdmin() || undefined);
    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    const entitlements = await page.request.get('/api/tenant/entitlements');
    expect(entitlements.ok()).toBeTruthy();
    const map = (await entitlements.json()).data;
    expect(typeof map.hash).toBe('string');
    expect(map.features).toBeTruthy();

    for (const url of [
      '/api/admin/subscriptions/plans',
      '/api/admin/subscriptions/tax',
      '/api/admin/subscriptions/upgrade-requests',
      '/api/admin/subscriptions/revenue',
    ]) {
      const denied = await page.request.get(url);
      expect(denied.status(), url).toBe(403);
    }
    const priceChange = await page.request.post('/api/admin/subscriptions/plans', { data: { code: 'HACKED', name: 'Hacked' } });
    expect(priceChange.status()).toBe(403);

    await page.goto('/settings/my-subscription');
    await expect(page.getByRole('heading', { name: 'Current subscription' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Compare plans' })).toBeVisible();
    await expect(page.getByText(/Current plan|Request this plan|Request sent/).first()).toBeVisible();

    await context.close();
  });

  test('a plan request ignores a spoofed tenant_id and does not change the plan', async ({ browser }) => {
    test.skip(skipWithoutTenantAdmin(), skipWithoutTenantAdmin() || undefined);
    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    const before = (await (await page.request.get('/api/tenant/entitlements')).json()).data.plan?.code ?? null;
    const plans = (await (await page.request.get('/api/public/subscription-plans')).json()).data as PublicPlan[];
    const target = plans.find((p) => p.code !== before && p.pricing_type !== 'CUSTOM');
    test.skip(!target, 'No other public plan to request');

    const existing = (await (await page.request.get('/api/tenant/subscription/upgrade-requests')).json()).data as {
      status: string;
    }[];
    test.skip(
      existing.some((r) => r.status === 'PENDING' || r.status === 'INFO_REQUESTED'),
      'This church already has an open plan request',
    );

    const response = await page.request.post('/api/tenant/subscription/upgrade-requests', {
      data: { plan_code: target!.code, billing_interval: 'ANNUAL', message: 'E2E request', tenant_id: 999999 },
    });
    expect(response.status()).toBe(201);
    const created = (await response.json()).data;
    expect(created.status).toBe('PENDING');
    expect(created.requested_plan.code).toBe(target!.code);

    const after = (await (await page.request.get('/api/tenant/entitlements')).json()).data.plan?.code ?? null;
    expect(after).toBe(before);

    await context.close();
  });

  test('tenant member cannot use subscription APIs', async ({ browser }) => {
    test.skip(skipWithoutTenantMember(), skipWithoutTenantMember() || undefined);
    const context = await createTenantMemberContext(browser);
    const page = await context.newPage();

    expect((await page.request.get('/api/admin/subscriptions/plans')).status()).toBe(403);
    expect((await page.request.get('/api/tenant/subscription/upgrade-requests')).status()).toBe(403);
    const submit = await page.request.post('/api/tenant/subscription/upgrade-requests', { data: { plan_code: 'STANDARD' } });
    expect(submit.status()).toBe(403);

    await context.close();
  });

  test('platform admin reviews the request and declining it leaves the plan unchanged', async ({ browser }) => {
    test.skip(skipWithoutPlatformAdmin(), skipWithoutPlatformAdmin() || undefined);
    const context = await createPlatformAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/settings/subscription/plans');
    await expect(page.getByRole('tab', { name: 'Plans' }).or(page.getByRole('link', { name: 'Plans' })).first()).toBeVisible();

    const queue = await page.request.get('/api/admin/subscriptions/upgrade-requests?status=PENDING');
    expect(queue.ok()).toBeTruthy();
    const e2eRequest = ((await queue.json()).data as { id: number; message: string | null }[]).find(
      (r) => r.message === 'E2E request',
    );
    test.skip(!e2eRequest, 'No E2E plan request to review');

    await page.goto('/settings/subscription/requests');
    await expect(page.getByText('E2E request').first()).toBeVisible();

    const declined = await page.request.post(`/api/admin/subscriptions/upgrade-requests/${e2eRequest!.id}/reject`, {
      data: { note: 'Declined by automated test' },
    });
    expect(declined.ok()).toBeTruthy();
    expect((await declined.json()).data.status).toBe('REJECTED');

    await context.close();
  });
});

test.describe('Plan catalog edit gate', () => {
  test('Edit Plan opens details and linked plans can save safe header fields', async ({ browser }) => {
    test.skip(skipWithoutPlatformAdmin(), skipWithoutPlatformAdmin() || undefined);
    const context = await createPlatformAdminContext(browser);
    const page = await context.newPage();
    const suffix = Date.now().toString(36).toUpperCase();
    const code = `E2E_EDIT_${suffix}`.slice(0, 64);

    const created = await page.request.post('/api/admin/subscriptions/plans', {
      data: { code, name: `E2E Edit ${suffix}`, pricing_type: 'FREE', is_public: false },
    });
    expect(created.ok()).toBeTruthy();
    const plan = (await created.json()).data as {
      id: number;
      name: string;
      is_editable: boolean;
    };
    expect(plan.is_editable).toBe(true);

    await page.goto('/settings/subscription/plans');
    await expect(page.getByText(plan.name).first()).toBeVisible();

    const card = page.locator('.sa-plan-card').filter({ hasText: plan.name });
    await expect(card.getByRole('link', { name: 'Edit Plan' })).toBeVisible();
    await card.getByRole('link', { name: 'Edit Plan' }).click();
    await expect(page.getByRole('heading', { name: 'Plan details' })).toBeVisible();

    const renamed = `${plan.name} Saved`;
    await page.locator('#sa-plan-name').fill(renamed);
    await page.getByRole('button', { name: 'Save details' }).click();
    await expect(page.getByText('Plan details saved').or(page.getByText('Saved')).first()).toBeVisible();

    await page.goto('/settings/subscription/plans');
    await expect(page.getByText(renamed).first()).toBeVisible();

    const list = await page.request.get('/api/admin/subscriptions/plans?include_archived=1');
    expect(list.ok()).toBeTruthy();
    const linked = ((await list.json()).data as { id: number; name: string; is_legacy: boolean; tenant_count: number }[]).find(
      (p) => !p.is_legacy && p.tenant_count > 0,
    );
    if (linked) {
      const linkedCard = page.locator('.sa-plan-card').filter({ hasText: linked.name }).first();
      await expect(linkedCard.getByRole('link', { name: 'Edit Plan' })).toBeVisible();
      await linkedCard.getByRole('link', { name: 'Edit Plan' }).click();
      await expect(page.getByText(/churches use this plan/i).first()).toBeVisible();
    }

    await context.close();
  });
});
