import { existsSync } from 'fs';
import { resolve } from 'path';
import { Browser, BrowserContext } from '@playwright/test';

const tenantAdminState = process.env.RBAC_TENANT_ADMIN_STORAGE_STATE;
const tenantMemberState = process.env.RBAC_TENANT_MEMBER_STORAGE_STATE;
const platformAdminState = process.env.RBAC_PLATFORM_ADMIN_STORAGE_STATE;
const expiredTenantAdminState = process.env.SUBSCRIPTION_EXPIRED_E2E_STORAGE_STATE;
const graceTenantAdminState = process.env.SUBSCRIPTION_GRACE_E2E_STORAGE_STATE;

function storageStateReady(path: string | undefined, label: string): string | false {
  if (!path) {
    return `${label} storage state not provided`;
  }

  const resolved = resolve(path);
  if (!existsSync(resolved)) {
    return `${label} storage state file not found: ${path}`;
  }

  return false;
}

export function hasTenantAdminStorageState(): boolean {
  return skipWithoutTenantAdmin() === false;
}

export function hasTenantMemberStorageState(): boolean {
  return skipWithoutTenantMember() === false;
}

export function hasPlatformAdminStorageState(): boolean {
  return skipWithoutPlatformAdmin() === false;
}

export async function createPlatformAdminContext(browser: Browser): Promise<BrowserContext> {
  const skipReason = skipWithoutPlatformAdmin();
  if (skipReason) {
    throw new Error(skipReason);
  }

  return browser.newContext({ storageState: platformAdminState });
}

export async function createTenantAdminContext(browser: Browser): Promise<BrowserContext> {
  const skipReason = skipWithoutTenantAdmin();
  if (skipReason) {
    throw new Error(skipReason);
  }

  return browser.newContext({ storageState: tenantAdminState });
}

export async function createTenantMemberContext(browser: Browser): Promise<BrowserContext> {
  const skipReason = skipWithoutTenantMember();
  if (skipReason) {
    throw new Error(skipReason);
  }

  return browser.newContext({ storageState: tenantMemberState });
}

export function skipWithoutTenantAdmin(): string | false {
  return storageStateReady(tenantAdminState, 'RBAC tenant admin');
}

export function skipWithoutTenantMember(): string | false {
  return storageStateReady(tenantMemberState, 'RBAC tenant member');
}

export function skipWithoutPlatformAdmin(): string | false {
  return storageStateReady(platformAdminState, 'RBAC platform admin');
}

export function hasExpiredTenantAdminStorageState(): boolean {
  return skipWithoutExpiredTenantAdmin() === false;
}

export async function createExpiredTenantAdminContext(browser: Browser): Promise<BrowserContext> {
  const skipReason = skipWithoutExpiredTenantAdmin();
  if (skipReason) {
    throw new Error(skipReason);
  }

  return browser.newContext({ storageState: expiredTenantAdminState });
}

export async function createGraceTenantAdminContext(browser: Browser): Promise<BrowserContext> {
  const skipReason = skipWithoutGraceTenantAdmin();
  if (skipReason) {
    throw new Error(skipReason);
  }

  return browser.newContext({ storageState: graceTenantAdminState });
}

export function skipWithoutExpiredTenantAdmin(): string | false {
  return storageStateReady(expiredTenantAdminState, 'Subscription expired parish admin');
}

export function skipWithoutGraceTenantAdmin(): string | false {
  return storageStateReady(graceTenantAdminState, 'Subscription grace parish admin');
}
