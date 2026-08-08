import { Routes } from '@angular/router';
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
  },
  {
    path: 'guests',
    loadComponent: () =>
      import('./pages/guest-member-list.page').then(m => m.GuestMemberListPageComponent),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./pages/taxonomy-settings.page').then(m => m.TaxonomySettingsPageComponent),
  },
  {
    path: 'audit',
    loadComponent: () =>
      import('./pages/audit-log.page').then(m => m.AuditLogPageComponent),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./pages/organization-detail.page').then(m => m.OrganizationDetailPageComponent),
    resolve: { breadcrumbLabel: OrganizationBreadcrumbResolver },
  },
];
