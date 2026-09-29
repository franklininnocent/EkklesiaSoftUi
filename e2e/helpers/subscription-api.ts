import { APIResponse, expect, Page } from '@playwright/test';

export interface SubscriptionAccessSnapshot {
  status: string;
  access_mode?: string;
  is_read_only?: boolean;
}

export async function fetchSubscriptionAccess(page: Page): Promise<SubscriptionAccessSnapshot> {
  const response = await page.request.get('/api/tenant/subscription-access');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.success).toBe(true);

  return body.data as SubscriptionAccessSnapshot;
}

export async function expectSubscriptionReadOnlyContract(response: APIResponse): Promise<void> {
  expect(response.status()).toBe(403);
  const body = await response.json();
  expect(body.success).toBe(false);
  expect(body.code).toBe('SUBSCRIPTION_READ_ONLY');
  expect(body.reason).toBe('subscription_blocked');
  expect(body.subscription_status).toBe('EXPIRED');
  expect(body.access_mode).toBe('read_only');
}
