export const EXPIRED_FAMILY_ID = 'e2e90001-0001-4000-8000-000000000001';

export const EXPIRED_FAMILY_NAME = 'E2E Expired Family';

export const EXPIRED_BCC_ID = 'e2e90001-0001-4000-8000-000000000010';

export function expiredTenantId(): string {
  const id = process.env.SUBSCRIPTION_EXPIRED_E2E_TENANT_ID;
  if (!id) {
    throw new Error('SUBSCRIPTION_EXPIRED_E2E_TENANT_ID not provided');
  }

  return id;
}

export function skipWithoutExpiredTenantId(): string | false {
  if (!process.env.SUBSCRIPTION_EXPIRED_E2E_TENANT_ID) {
    return 'SUBSCRIPTION_EXPIRED_E2E_TENANT_ID not provided';
  }

  return false;
}

export function skipWithoutRenewalFixture(): string | false {
  const tenantSkip = skipWithoutExpiredTenantId();
  if (tenantSkip) {
    return tenantSkip;
  }

  const platformState = process.env.RBAC_PLATFORM_ADMIN_STORAGE_STATE;
  if (!platformState) {
    return 'RBAC_PLATFORM_ADMIN_STORAGE_STATE not provided (renewal E2E skipped)';
  }

  return false;
}
