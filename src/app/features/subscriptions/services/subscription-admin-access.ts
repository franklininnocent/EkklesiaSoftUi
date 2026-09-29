import { AuthService } from '@core/services/auth.service';

export const SUBSCRIPTION_PERMISSIONS = {
  plansView: 'subscriptions.plans.view',
  plansManage: 'subscriptions.plans.manage',
  plansPublish: 'subscriptions.plans.publish',
  featuresManage: 'subscriptions.features.manage',
  tenantsManage: 'subscriptions.tenants.manage',
  overridesManage: 'subscriptions.overrides.manage',
  usageView: 'subscriptions.usage.view',
  revenueView: 'subscriptions.revenue.view',
  requestsReview: 'subscriptions.requests.review',
  auditView: 'subscriptions.audit.view',
  policiesManage: 'subscriptions.policies.manage',
} as const;

export interface SubscriptionAdminCapabilities {
  view: boolean;
  manage: boolean;
  publish: boolean;
  /** Super Admin only — catalog plan delete. */
  delete: boolean;
  features: boolean;
  tenants: boolean;
  overrides: boolean;
  usage: boolean;
  revenue: boolean;
  requests: boolean;
  audit: boolean;
  policies: boolean;
}

/** Which controls to show. The API enforces the same permissions independently. */
export function subscriptionAdminCapabilities(auth: AuthService): SubscriptionAdminCapabilities {
  const superAdmin = auth.isSuperAdmin();
  const can = (permission: string) => superAdmin || auth.hasPermission(permission);
  const p = SUBSCRIPTION_PERMISSIONS;

  return {
    view: can(p.plansView),
    manage: can(p.plansManage),
    publish: can(p.plansPublish),
    delete: superAdmin,
    features: can(p.featuresManage),
    tenants: can(p.tenantsManage),
    overrides: can(p.overridesManage),
    usage: can(p.usageView),
    revenue: can(p.revenueView),
    requests: can(p.requestsReview),
    audit: can(p.auditView),
    policies: can(p.policiesManage),
  };
}
