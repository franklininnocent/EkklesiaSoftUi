import { inject } from '@angular/core';
import { Router, Routes, UrlTree } from '@angular/router';
import { massScheduleCanDeactivateGuard } from './guards/mass-schedule-can-deactivate.guard';
import { massSchedulePermissionGuard } from './guards/mass-schedule-permission.guard';

function redirectLegacyMassIntentionCreate(): UrlTree {
  const router = inject(Router);
  return router.createUrlTree(['/mass-intentions/intentions'], {
    queryParams: { create: '1' },
  });
}

export const MASS_INTENTIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/mass-intentions-workspace-shell.component').then(
        (m) => m.MassIntentionsWorkspaceShellComponent
      ),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/mass-intentions-home.page').then((m) => m.MassIntentionsHomePageComponent),
      },
      {
        path: 'intentions',
        loadComponent: () =>
          import('./pages/mass-intentions-list.page').then((m) => m.MassIntentionsListPageComponent),
      },
      {
        path: 'reports',
        data: { breadcrumbLabel: 'Reports' },
        loadComponent: () =>
          import('./pages/mass-intentions-register.page').then((m) => m.MassIntentionsRegisterPageComponent),
      },
      {
        path: 'settings',
        data: { breadcrumbLabel: 'Settings' },
        loadComponent: () =>
          import('./pages/mass-intentions-settings.page').then((m) => m.MassIntentionsSettingsPageComponent),
      },
      {
        path: 'audit',
        data: { breadcrumbLabel: 'Audit' },
        loadComponent: () =>
          import('./pages/mass-intentions-audit.page').then((m) => m.MassIntentionsAuditPageComponent),
      },
      {
        path: 'masses',
        data: { breadcrumbLabel: 'Masses' },
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./pages/mass-celebrations-list.page').then((m) => m.MassCelebrationsListPageComponent),
          },
          {
            path: 'list',
            redirectTo: '',
            pathMatch: 'full',
          },
          {
            path: 'week',
            loadComponent: () =>
              import('./pages/mass-celebrations-week.page').then((m) => m.MassCelebrationsWeekPageComponent),
          },
          {
            path: 'schedule',
            canActivate: [massSchedulePermissionGuard],
            canDeactivate: [massScheduleCanDeactivateGuard],
            loadComponent: () =>
              import('./pages/mass-regular-schedule.page').then((m) => m.MassRegularSchedulePageComponent),
          },
          {
            path: 'temporaries',
            canActivate: [massSchedulePermissionGuard],
            children: [
              {
                path: '',
                loadComponent: () =>
                  import('./pages/mass-temporary-schedules.page').then(
                    (m) => m.MassTemporarySchedulesPageComponent
                  ),
              },
              {
                path: ':scheduleId',
                canDeactivate: [massScheduleCanDeactivateGuard],
                loadComponent: () =>
                  import('./pages/mass-regular-schedule.page').then((m) => m.MassRegularSchedulePageComponent),
              },
            ],
          },
          {
            path: ':id',
            data: { breadcrumbLabel: 'Mass' },
            loadComponent: () =>
              import('./pages/mass-celebration-detail.page').then((m) => m.MassCelebrationDetailPageComponent),
          },
        ],
      },
      { path: 'intentions/new', redirectTo: redirectLegacyMassIntentionCreate },
      { path: 'more', redirectTo: '', pathMatch: 'full' },
    ],
  },
];
