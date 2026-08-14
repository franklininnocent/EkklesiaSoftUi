import { Routes, Router, ActivatedRouteSnapshot, UrlTree } from '@angular/router';
import { inject } from '@angular/core';
import { rbacGuard } from '@core/guards/rbac.guard';
import { tenantAdminGuard } from '@core/guards/tenant-admin.guard';
import { subscriptionViewGuard } from '@core/guards/subscription-view.guard';

function redirectLegacyRegisterQuery(route: ActivatedRouteSnapshot): boolean | UrlTree {
  const router = inject(Router);
  const qp = route.queryParams;
  if (qp['create'] || qp['edit']) {
    return router.createUrlTree(['/sacraments'], { queryParams: qp });
  }
  return true;
}

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./settings.component').then(m => m.SettingsComponent)
  },
  {
    path: 'roles-permissions',
    canActivate: [rbacGuard],
    loadComponent: () => import('./roles-permissions/roles-permissions.component').then(m => m.RolesPermissionsComponent)
  },
  {
    path: 'ecclesiastical',
    loadChildren: () => import('./ecclesiastical/ecclesiastical.routes').then(m => m.ECCLESIASTICAL_ROUTES)
  },
  {
    path: 'sacraments/view/:id',
    redirectTo: '/sacraments/view/:id',
    pathMatch: 'full',
  },
  {
    path: 'sacraments/migration',
    redirectTo: '/sacraments/migration',
    pathMatch: 'full',
  },
  {
    path: 'sacraments/holy-orders/create',
    redirectTo: '/sacraments/holy-orders/create',
    pathMatch: 'full',
  },
  {
    path: 'sacraments/create',
    redirectTo: '/sacraments/create',
    pathMatch: 'full',
  },
  {
    path: 'sacraments/edit/:id',
    redirectTo: '/sacraments/edit/:id',
    pathMatch: 'full',
  },
  {
    path: 'sacraments',
    canActivate: [redirectLegacyRegisterQuery],
    loadComponent: () =>
      import('./sacrament-settings/sacrament-settings.page').then((m) => m.SacramentSettingsPage),
  },
  {
    path: 'pope',
    loadComponent: () => import('./pope-settings/pope-settings.component').then(m => m.PopeSettingsComponent)
  },
  {
    path: 'subscription',
    canActivate: [tenantAdminGuard],
    loadComponent: () => import('./subscription/subscription-management.component').then(m => m.SubscriptionManagementComponent)
  },
  {
    path: 'my-subscription',
    canActivate: [subscriptionViewGuard],
    loadComponent: () => import('./my-subscription/my-subscription.component').then(m => m.MySubscriptionComponent)
  },
  {
    path: 'support-access',
    loadComponent: () =>
      import('./support-access-windows/support-access-windows.page').then(
        (m) => m.SupportAccessWindowsPage
      ),
  },
  {
    path: 'data-export',
    loadComponent: () =>
      import('./data-export/data-export.page').then((m) => m.DataExportPage),
  },
];
