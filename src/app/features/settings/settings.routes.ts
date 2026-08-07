import { Routes } from '@angular/router';
import { rbacGuard } from '@core/guards/rbac.guard';

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
    path: 'sacraments',
    loadChildren: () => import('./sacraments/sacraments.routes').then(m => m.SACRAMENTS_ROUTES)
  },
  {
    path: 'pope',
    loadComponent: () => import('./pope-settings/pope-settings.component').then(m => m.PopeSettingsComponent)
  },
  {
    path: 'subscription',
    loadComponent: () => import('./subscription/subscription-management.component').then(m => m.SubscriptionManagementComponent)
  },
  {
    path: 'support-access',
    loadComponent: () =>
      import('./support-access-windows/support-access-windows.page').then(
        (m) => m.SupportAccessWindowsPage
      ),
  }
];

