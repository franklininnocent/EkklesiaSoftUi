import { existsSync } from 'fs';
import { resolve } from 'path';
import { Browser, BrowserContext } from '@playwright/test';

const tenantAdminState = process.env.RBAC_TENANT_ADMIN_STORAGE_STATE;
const tenantMemberState = process.env.RBAC_TENANT_MEMBER_STORAGE_STATE;

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
