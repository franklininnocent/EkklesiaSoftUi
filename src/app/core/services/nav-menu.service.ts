import { Injectable, inject } from '@angular/core';
import { User } from '@core/models';
import { ApplicationContextService } from '@core/services/application-context.service';
import { AuthService } from '@core/services/auth.service';
import { SubscriptionAccessService } from '@core/services/subscription-access.service';
import { EntitlementService } from '@core/services/entitlement.service';
import { featuresForRoute } from '@core/config/feature-requirements';
import {
  hasSettingsNavPermission,
  isSettingsNavItemVisible,
  SettingsNavVisibilityKey,
} from '@features/settings/config/settings-nav.visibility';

export type NavMenuId =
  | 'dashboard'
  | 'church-profile'
  | 'church-profile-diocesan'
  | 'church-profile-edit'
  | 'families'
  | 'bccs'
  | 'members'
  | 'donations'
  | 'ministries'
  | 'ministries-audit'
  | 'tenants'
  | 'platform-ministries'
  | 'roles-permissions'
  | 'roles-permissions-assignments'
  | 'sacraments'
  | 'mass-intentions'
  | 'users'
  | 'support'
  | 'support-center'
  | 'application-access'
  | 'notifications'
  | 'settings'
  | 'settings-my-subscription'
  | 'settings-ecclesiastical'
  | 'settings-pope'
  | 'settings-sacrament-settings'
  | 'settings-subscription'
  | 'settings-support-access'
  | 'settings-forgot-password-requests'
  | 'settings-data-export'
  | 'settings-default-seeds';

type NavAudience = 'ekklesia' | 'tenant' | 'both';

export interface SupportParishWorkspaceLink {
  id: NavMenuId;
  label: string;
  route: string;
}

@Injectable({ providedIn: 'root' })
export class NavMenuService {
  private static readonly SUPPORT_PARISH_WORKSPACE_LINKS: readonly SupportParishWorkspaceLink[] = [
    { id: 'church-profile', label: 'Church Profile', route: '/church-profile' },
    { id: 'families', label: 'Families', route: '/families' },
    { id: 'members', label: 'Members', route: '/members' },
    { id: 'bccs', label: 'BCCs', route: '/bccs' },
    { id: 'donations', label: 'Donations', route: '/donations' },
    { id: 'ministries', label: 'Ministries', route: '/ministries' },
    { id: 'sacraments', label: 'Sacraments', route: '/sacraments' },
    { id: 'mass-intentions', label: 'Mass intentions', route: '/mass-intentions' },
    { id: 'users', label: 'Users', route: '/users' },
    { id: 'roles-permissions', label: 'Roles & Permissions', route: '/settings/roles-permissions' },
  ];
  /** Plan feature each menu item needs (hidden when the church's plan does not include it). */
  static readonly MENU_FEATURE_REQUIREMENTS: Readonly<Partial<Record<NavMenuId, string>>> = {
    donations: 'CONTRIBUTIONS',
    ministries: 'MINISTRIES',
    'mass-intentions': 'MASS_INTENTIONS',
    'ministries-audit': 'AUDIT_LOG',
    'settings-data-export': 'IMPORT_EXPORT',
  };

  private readonly auth = inject(AuthService);
  private readonly appContext = inject(ApplicationContextService);
  private readonly subscriptionAccess = inject(SubscriptionAccessService);
  private readonly entitlements = inject(EntitlementService);

  isVisible(id: NavMenuId, user: User | null): boolean {
    if (!this.isVisibleForRole(id, user)) {
      return false;
    }
    const feature = NavMenuService.MENU_FEATURE_REQUIREMENTS[id];
    return !feature || this.entitlements.hasFeature(feature);
  }

  /** Whether a link's target is part of the church's plan (see ROUTE_FEATURE_REQUIREMENTS). */
  isRouteAllowed(route: string): boolean {
    return this.entitlements.hasAllFeatures(featuresForRoute(route));
  }

  private isVisibleForRole(id: NavMenuId, user: User | null): boolean {
    if (!user) {
      return id === 'dashboard';
    }

    const settingsKey = this.settingsVisibilityKey(id);
    if (settingsKey) {
      const settingsVisible = isSettingsNavItemVisible(settingsKey, user, this.auth);
      if (!settingsVisible) {
        return false;
      }
      if (
        (id === 'settings-data-export' || id === 'settings-default-seeds') &&
        !hasSettingsNavPermission(settingsKey, user, this.auth)
      ) {
        return false;
      }
      return true;
    }

    if (id === 'roles-permissions-assignments') {
      return (
        !!user.tenant_id &&
        !this.auth.isSuperAdmin() &&
        !this.auth.isEkklesiaAdmin() &&
        this.auth.canAccessRbac(user)
      );
    }

    if (id === 'church-profile-diocesan') {
      return (
        !!user.tenant_id &&
        (this.auth.hasTenantPermission('bishops.view') ||
          this.auth.hasTenantPermission('bishops.submit_update_request') ||
          this.auth.hasTenantPermission('bishops.view_own_requests'))
      );
    }

    if (id === 'church-profile-edit') {
      return (
        !!user.tenant_id &&
        (this.auth.hasPermission('church.settings.edit') ||
          user.is_primary_admin === true ||
          this.auth.isTenantAdmin(user))
      );
    }

    const nav = this.appContext.resolveNavigationSnapshot(user);
    const audience = this.audienceFor(id);

    if (audience === 'ekklesia') {
      if (nav.actorKind !== 'platform') {
        return false;
      }

      return this.canSeeEkklesiaItem(id, user);
    }

    if (audience === 'tenant') {
      if (nav.actorKind !== 'tenant') {
        return false;
      }
      return this.canSeeTenantItem(id, user);
    }

    return this.canSeeSharedItem(id, user);
  }

  /** Parish product links for the support session banner — not the Ekklesia sidebar. */
  getSupportParishWorkspaceLinks(user: User | null): SupportParishWorkspaceLink[] {
    if (!user || !this.appContext.hasSupportTenantContext(user)) {
      return [];
    }

    return NavMenuService.SUPPORT_PARISH_WORKSPACE_LINKS.filter((link) =>
      this.isVisibleInSupportParishWorkspace(link.id, user)
    );
  }

  isVisibleInSupportParishWorkspace(id: NavMenuId, user: User | null): boolean {
    if (!user || !this.appContext.hasSupportTenantContext(user)) {
      return false;
    }

    const audience = this.audienceFor(id);
    if (audience === 'tenant') {
      return this.canSeeTenantItem(id, user, true);
    }

    if (id === 'roles-permissions') {
      return this.auth.canAccessRbac(user);
    }

    return false;
  }

  private settingsVisibilityKey(id: NavMenuId): SettingsNavVisibilityKey | null {
    if (!id.startsWith('settings-') || id === 'settings') {
      return null;
    }
    const key = id.replace('settings-', '') as SettingsNavVisibilityKey;
    const allowed: SettingsNavVisibilityKey[] = [
      'my-subscription',
      'ecclesiastical',
      'pope',
      'sacrament-settings',
      'subscription',
      'support-access',
      'forgot-password-requests',
      'data-export',
      'default-seeds',
    ];
    return allowed.includes(key) ? key : null;
  }

  private audienceFor(id: NavMenuId): NavAudience {
    switch (id) {
      case 'tenants':
      case 'platform-ministries':
      case 'support-center':
      case 'application-access':
      case 'settings-ecclesiastical':
      case 'settings-pope':
      case 'settings-subscription':
        return 'ekklesia';
      case 'church-profile':
      case 'families':
      case 'members':
      case 'bccs':
      case 'donations':
      case 'ministries':
      case 'ministries-audit':
      case 'support':
      case 'sacraments':
      case 'mass-intentions':
      case 'users':
      case 'roles-permissions-assignments':
      case 'settings-my-subscription':
      case 'settings-sacrament-settings':
      case 'settings-support-access':
      case 'settings-data-export':
      case 'settings-default-seeds':
        return 'tenant';
      default:
        return 'both';
    }
  }

  private canSeeEkklesiaItem(id: NavMenuId, user: User): boolean {
    switch (id) {
      case 'tenants':
      case 'platform-ministries':
        return this.auth.canManageTenants(user);
      case 'support-center':
        return this.auth.canAccessSupportCenter(user);
      case 'application-access':
        return this.auth.canAccessApplicationAccess(user);
      default:
        return false;
    }
  }

  private canSeeTenantItem(id: NavMenuId, user: User, hasActiveSupportSession = false): boolean {
    switch (id) {
      case 'church-profile':
      case 'families':
      case 'members':
        return true;
      case 'bccs':
        return this.auth.canAccessBcc(user, { hasActiveSupportSession });
      case 'donations':
        return this.canViewDonations(user, hasActiveSupportSession);
      case 'ministries':
        return this.canAccessMinistries(user, hasActiveSupportSession);
      case 'ministries-audit':
        return this.auth.canViewTenantAuditLogs(user);
      case 'support':
        return this.auth.canAccessSupport(user);
      case 'sacraments':
      case 'users':
        return true;
      case 'mass-intentions':
        return this.canAccessMassIntentions(user, hasActiveSupportSession);
      default:
        return false;
    }
  }

  private canSeeSharedItem(id: NavMenuId, user: User): boolean {
    switch (id) {
      case 'dashboard':
      case 'notifications':
      case 'settings':
        return true;
      case 'roles-permissions':
        return this.auth.canAccessRbac(user);
      default:
        return false;
    }
  }

  private canViewDonations(user: User, hasActiveSupportSession = false): boolean {
    if (!this.auth.canAccessDonations(user, { hasActiveSupportSession })) {
      return false;
    }

    if (user.tenant_id && !this.auth.isSuperAdmin() && !this.auth.isEkklesiaAdmin()) {
      return this.subscriptionAccess.canViewGatedModules();
    }

    return true;
  }

  private canAccessMinistries(user: User, hasActiveSupportSession = false): boolean {
    if (!this.auth.canAccessMinistries(user, { hasActiveSupportSession })) {
      return false;
    }

    if (user.tenant_id && !this.auth.isSuperAdmin() && !this.auth.isEkklesiaAdmin()) {
      return this.subscriptionAccess.canViewGatedModules();
    }

    return true;
  }

  private canAccessMassIntentions(user: User, hasActiveSupportSession = false): boolean {
    if (!this.auth.canAccessMassIntentions(user, { hasActiveSupportSession })) {
      return false;
    }

    if (user.tenant_id && !this.auth.isSuperAdmin() && !this.auth.isEkklesiaAdmin()) {
      return this.subscriptionAccess.canViewGatedModules();
    }

    return true;
  }
}
