import { existsSync } from 'fs';
import { resolve } from 'path';

import { skipWithoutTenantAdmin } from './auth-context';

const foreignFamilyId = process.env.CROSS_TENANT_FOREIGN_FAMILY_ID;

export function skipWithoutCrossTenantFixture(): string | false {
  const adminSkip = skipWithoutTenantAdmin();
  if (adminSkip) {
    return adminSkip;
  }

  if (!foreignFamilyId) {
    return 'CROSS_TENANT_FOREIGN_FAMILY_ID not provided';
  }

  return false;
}

export function crossTenantForeignFamilyId(): string {
  if (!foreignFamilyId) {
    throw new Error('CROSS_TENANT_FOREIGN_FAMILY_ID not provided');
  }

  return foreignFamilyId;
}

export function crossTenantManifestPath(): string | false {
  const path = process.env.CROSS_TENANT_MANIFEST_FILE;
  if (!path) {
    return false;
  }

  const resolved = resolve(path);
  if (!existsSync(resolved)) {
    return `CROSS_TENANT_MANIFEST_FILE not found: ${path}`;
  }

  return false;
}
