import { Routes } from '@angular/router';
import { tenantAuditGuard } from '@core/guards/tenant-audit.guard';
import { entitlementGuard } from '@core/guards/entitlement.guard';
import { OrganizationBreadcrumbResolver } from './resolvers/organization-breadcrumb.resolver';

export const MINISTRIES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/organization-list.page').then(m => m.OrganizationListPageComponent),
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./pages/organization-form.page').then(m => m.OrganizationFormPageComponent),
    data: { breadcrumbLabel: 'Add organization' },
  },
  {
    path: 'guests',
    loadComponent: () =>
      import('./pages/guest-member-list.page').then(m => m.GuestMemberListPageComponent),
    data: { breadcrumbLabel: 'Guest members' },
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./pages/taxonomy-settings.page').then(m => m.TaxonomySettingsPageComponent),
    data: { breadcrumbLabel: 'Settings' },
  },
  {
    path: 'audit',
    canActivate: [tenantAuditGuard, entitlementGuard],
    loadComponent: () =>
      import('./pages/audit-log.page').then(m => m.AuditLogPageComponent),
    data: { breadcrumbLabel: 'Audit log', feature: 'AUDIT_LOG' },
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./pages/organization-detail.page').then(m => m.OrganizationDetailPageComponent),
    resolve: { breadcrumbLabel: OrganizationBreadcrumbResolver },
  },
];
