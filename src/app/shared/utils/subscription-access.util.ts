import { User } from '@core/models';

const TENANT_ADMIN_ROLE_NAMES = ['Administrator', 'Church Administrator'] as const;

/**
 * Whether the user may open Settings → My Subscription.
 * Mirrors API authorization and subscriptionViewGuard:
 * - platform SuperAdmin/EkklesiaAdmin with a tenant context
 * - primary admin / Administrator / Church Administrator
 * - users with subscription.view
 */
export function canViewMySubscription(user: User | null | undefined): boolean {
  if (!user) {
    return false;
  }

  if (isPlatformSubscriptionAdmin(user)) {
    return hasTenantContext(user);
  }

  if (!hasTenantContext(user)) {
    return false;
  }

  return isPrimaryAdmin(user) || hasTenantAdminRole(user) || hasSubscriptionViewPermission(user);
}

function hasTenantContext(user: User): boolean {
  return user.tenant_id !== null && user.tenant_id !== undefined;
}

function isPlatformSubscriptionAdmin(user: User): boolean {
  if (user.is_super_admin === true || user.is_admin === true) {
    return true;
  }

  const platformRoles = ['SuperAdmin', 'EkklesiaAdmin'];
  if (user.role_name && platformRoles.includes(user.role_name)) {
    return true;
  }
  if (user.role?.name && platformRoles.includes(user.role.name)) {
    return true;
  }
  return (user.roles || []).some((role) => role?.name && platformRoles.includes(role.name));
}

function isPrimaryAdmin(user: User): boolean {
  const primaryAdminRaw = (user as { is_primary_admin?: boolean | number | string }).is_primary_admin;
  return primaryAdminRaw === true || primaryAdminRaw === 1 || primaryAdminRaw === '1';
}

function hasTenantAdminRole(user: User): boolean {
  return TENANT_ADMIN_ROLE_NAMES.some(
    (roleName) =>
      (user.roles || []).some((role) => role?.name === roleName) ||
      user.role_name === roleName ||
      user.role?.name === roleName
  );
}

function hasSubscriptionViewPermission(user: User): boolean {
  return !!user.permissions?.some((permission) => permission.name === 'subscription.view');
}
