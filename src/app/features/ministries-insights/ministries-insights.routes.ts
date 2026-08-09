import { Routes } from '@angular/router';
import { MinistriesInsightsShellPageComponent } from './pages/ministries-insights-shell.page';

export const MINISTRIES_INSIGHTS_ROUTES: Routes = [
  {
    path: '',
    component: MinistriesInsightsShellPageComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      {
        path: 'overview',
        loadComponent: () =>
          import('./pages/overview.page').then((m) => m.MinistriesInsightsOverviewPageComponent),
      },
      {
        path: 'tenants',
        loadComponent: () =>
          import('./pages/tenants.page').then((m) => m.MinistriesInsightsTenantsPageComponent),
      },
      {
        path: 'tenants/:tenantId',
        loadComponent: () =>
          import('./pages/tenant-detail.page').then((m) => m.MinistriesInsightsTenantDetailPageComponent),
      },
      {
        path: 'organizations',
        loadComponent: () =>
          import('./pages/organizations.page').then((m) => m.MinistriesInsightsOrganizationsPageComponent),
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('./pages/analytics.page').then((m) => m.MinistriesInsightsAnalyticsPageComponent),
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./pages/reports.page').then((m) => m.MinistriesInsightsReportsPageComponent),
      },
    ],
  },
];
