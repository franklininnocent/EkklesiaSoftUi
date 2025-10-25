import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';
import { tenantGuard } from '@core/guards/tenant.guard';
import { tenantAdminGuard } from '@core/guards/tenant-admin.guard';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'auth/login',
    pathMatch: 'full'
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES)
  },
  // Direct dashboard access (simplified)
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadChildren: () => import('./features/dashboard/dashboard.routes').then(m => m.DASHBOARD_ROUTES)
      },
      {
        path: 'profile',
        loadChildren: () => import('./features/profile/profile.routes').then(m => m.PROFILE_ROUTES)
      },
      {
        path: 'settings',
        loadChildren: () => import('./features/settings/settings.routes').then(m => m.SETTINGS_ROUTES)
      },
      {
        path: 'users',
        loadChildren: () => import('./features/users/users.routes').then(m => m.USERS_ROUTES)
      },
      {
        path: 'tenants',
        canActivate: [tenantAdminGuard],
        loadChildren: () => import('./features/tenants/tenants.routes').then(m => m.TENANTS_ROUTES)
      }
    ]
  },
  // Tenant-specific routes (for multi-tenant features)
  {
    path: 'tenant/:tenantId',
    component: MainLayoutComponent,
    canActivate: [authGuard, tenantGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadChildren: () => import('./features/dashboard/dashboard.routes').then(m => m.DASHBOARD_ROUTES)
      },
      {
        path: 'profile',
        loadChildren: () => import('./features/profile/profile.routes').then(m => m.PROFILE_ROUTES)
      },
      {
        path: 'settings',
        loadChildren: () => import('./features/settings/settings.routes').then(m => m.SETTINGS_ROUTES)
      },
      {
        path: 'users',
        loadChildren: () => import('./features/users/users.routes').then(m => m.USERS_ROUTES)
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'auth/login'
  }
];

