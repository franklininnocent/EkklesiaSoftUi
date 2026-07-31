import { Role } from '@core/models';

const LEGACY_PROTECTED_ROLE_NAMES = [
  'Administrator',
  'Church Administrator',
  'Super Administrator',
  'Super Admin'
];

export function isProtectedRoleDefinition(role: Role | null | undefined): boolean {
  if (!role) {
    return false;
  }

  if (role.role_classification === 'protected_system') {
    return true;
  }

  return LEGACY_PROTECTED_ROLE_NAMES.includes(role.name || '');
}
