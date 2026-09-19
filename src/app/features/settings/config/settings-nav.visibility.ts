import { User } from '@core/models';
import { AuthService } from '@core/services/auth.service';

export type SettingsNavVisibilityKey =
  | 'my-subscription'
  | 'ecclesiastical'
  | 'pope'
  | 'sacrament-settings'
  | 'subscription'
  | 'support-access'
  | 'forgot-password-requests'
  | 'data-export'
  | 'default-seeds';

function isSuperAdminCard(user: User, auth: AuthService): boolean {
  if (user.is_admin === true || user.is_super_admin === true) {
    return true;
  }
  if (user.role_name === 'SuperAdmin' || user.role_name === 'EkklesiaAdmin') {
    return true;
  }
  if (user.role?.name === 'SuperAdmin' || user.role?.name === 'EkklesiaAdmin') {
    return true;
  }
  return false;
}

function isParishHome(user: User, auth: AuthService): boolean {
  return user.tenant_id !== null && !auth.isPlatformActor(user);
}

/** Mirrors Settings hub card visibility — keep aligned with settings.component. */
export function isSettingsNavItemVisible(
  key: SettingsNavVisibilityKey,
  user: User | null,
  auth: AuthService
): boolean {
  if (!user) {
    return false;
  }

  switch (key) {
    case 'my-subscription':
      return auth.canViewMySubscription(user);
    case 'ecclesiastical':
      return auth.hasEkklesiaRole(user);
    case 'pope':
    case 'subscription':
      return isSuperAdminCard(user, auth);
    case 'sacrament-settings':
    case 'data-export':
    case 'default-seeds':
      return isParishHome(user, auth);
    case 'support-access':
      return (
        isParishHome(user, auth) &&
        auth.hasAnyPermission(['support.grants.parish.view', 'support.grants.parish.manage'])
      );
    case 'forgot-password-requests':
      return auth.canViewPasswordRecoveryRequests(user);
    default:
      return false;
  }
}

export function hasSettingsNavPermission(
  key: SettingsNavVisibilityKey,
  user: User,
  auth: AuthService
): boolean {
  switch (key) {
    case 'data-export':
      return auth.hasTenantPermission('tenant.data.export');
    case 'default-seeds':
      return auth.hasAnyPermission([
        'settings.default-seeds.view',
        'settings.default-seeds.run',
      ]);
    default:
      return true;
  }
}
