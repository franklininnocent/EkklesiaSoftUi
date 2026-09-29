import { Routes } from '@angular/router';
import { subscriptionTaxCanDeactivateGuard } from './guards/subscription-tax-can-deactivate.guard';

/**
 * Platform subscription administration, mounted at /settings/subscription behind tenantAdminGuard.
 * Every action is authorized again by the API (platform role + subscriptions.* permission).
 */
export const SUBSCRIPTION_ADMIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/subscription-admin-shell/subscription-admin-shell.page').then((m) => m.SubscriptionAdminShellPage),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'plans' },
      {
        path: 'overview',
        loadComponent: () =>
          import('./pages/subscription-overview/subscription-overview.page').then((m) => m.SubscriptionOverviewPage),
      },
      {
        path: 'requests',
        loadComponent: () => import('./pages/upgrade-requests/upgrade-requests.page').then((m) => m.UpgradeRequestsPage),
      },
      {
        path: 'usage',
        loadComponent: () => import('./pages/tenant-usage/tenant-usage.page').then((m) => m.TenantUsagePageComponent),
      },
      {
        path: 'plans',
        loadComponent: () => import('./pages/plan-catalog/plan-catalog.page').then((m) => m.PlanCatalogPage),
      },
      {
        path: 'plans/:planId',
        loadComponent: () => import('./pages/plan-editor/plan-editor.page').then((m) => m.PlanEditorPage),
      },
      {
        path: 'matrix',
        loadComponent: () => import('./pages/feature-matrix/feature-matrix.page').then((m) => m.FeatureMatrixPage),
      },
      {
        path: 'features',
        loadComponent: () => import('./pages/feature-catalog/feature-catalog.page').then((m) => m.FeatureCatalogPage),
      },
      {
        path: 'policies',
        loadComponent: () =>
          import('./pages/subscription-policies/subscription-policies.page').then((m) => m.SubscriptionPoliciesPage),
      },
      {
        path: 'tax',
        canDeactivate: [subscriptionTaxCanDeactivateGuard],
        loadComponent: () =>
          import('./pages/subscription-tax/subscription-tax.page').then((m) => m.SubscriptionTaxPage),
      },
      {
        path: 'audit',
        loadComponent: () => import('./pages/subscription-audit/subscription-audit.page').then((m) => m.SubscriptionAuditPage),
      },
      {
        path: 'access',
        loadComponent: () =>
          import('@features/settings/subscription/subscription-management.component').then(
            (m) => m.SubscriptionManagementComponent,
          ),
      },
    ],
  },
];
