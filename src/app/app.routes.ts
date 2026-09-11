import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';
import { tenantGuard } from '@core/guards/tenant.guard';
import { tenantAdminGuard } from '@core/guards/tenant-admin.guard';
import { supportCenterGuard } from '@core/guards/support-center.guard';
import { applicationAccessGuard } from '@core/guards/application-access.guard';
import { donationsGuard } from '@core/guards/donations.guard';
import { ministriesGuard } from '@core/guards/ministries.guard';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { FamilyListComponent } from './features/family-management/components/family-list/family-list';
import { FamilyDetail } from './features/family-management/components/family-detail/family-detail';
import { FamilyBreadcrumbResolver } from './features/family-management/resolvers/family-breadcrumb.resolver';
import { bccGuard } from './core/guards/bcc.guard';
import { supportGuard } from './core/guards/support.guard';

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
  {
    path: 'verify/certificate/:token',
    loadComponent: () =>
      import('./features/settings/sacraments/certificates/verify/certificate-verify-page.component').then(
        (m) => m.CertificateVerifyPageComponent
      ),
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
        path: 'sacraments',
        loadChildren: () => import('./features/settings/sacraments/sacraments.routes').then(m => m.SACRAMENTS_ROUTES)
      },
      {
        path: 'users',
        loadChildren: () => import('./features/users/users.routes').then(m => m.USERS_ROUTES)
      },
      {
        path: 'tenants',
        canActivate: [tenantAdminGuard],
        loadChildren: () => import('./features/tenants/tenants.routes').then(m => m.TENANTS_ROUTES)
      },
      {
        path: 'support-center',
        canActivate: [supportCenterGuard],
        loadChildren: () =>
          import('./features/support-center/support-center.routes').then((m) => m.SUPPORT_CENTER_ROUTES),
      },
      {
        path: 'application-access',
        canActivate: [applicationAccessGuard],
        loadChildren: () =>
          import('./features/application-access/application-access.routes').then(
            (m) => m.APPLICATION_ACCESS_ROUTES
          ),
      },
      {
        path: 'platform/ministries',
        canActivate: [tenantAdminGuard],
        loadChildren: () =>
          import('./features/ministries-insights/ministries-insights.routes').then(
            (m) => m.MINISTRIES_INSIGHTS_ROUTES
          ),
      },
      {
        path: 'church-profile',
        loadChildren: () => import('./features/tenants/church-profile/church-profile.routes').then(m => m.CHURCH_PROFILE_ROUTES)
      },
      {
        path: 'families',
        component: FamilyListComponent
      },
      {
        path: 'families/:id',
        component: FamilyDetail,
        resolve: { breadcrumbLabel: FamilyBreadcrumbResolver }
      },
      {
        path: 'bccs',
        canActivate: [bccGuard],
        loadChildren: () => import('./features/bcc-management/bcc.routes').then((m) => m.BCC_ROUTES)
      },
      {
        path: 'members',
        loadChildren: () => import('./features/members/members.routes').then(m => m.MEMBERS_ROUTES)
      },
      {
        path: 'donations',
        canActivate: [donationsGuard],
        loadChildren: () => import('./features/donations/donations.routes').then(m => m.DONATIONS_ROUTES)
      },
      {
        path: 'ministries',
        canActivate: [ministriesGuard],
        loadChildren: () =>
          import('./features/ministries-associations/ministries.routes').then(m => m.MINISTRIES_ROUTES)
      },
      {
        path: 'support',
        canActivate: [supportGuard],
        loadChildren: () => import('./features/support/support.routes').then((m) => m.SUPPORT_ROUTES),
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
        path: 'sacraments',
        loadChildren: () => import('./features/settings/sacraments/sacraments.routes').then(m => m.SACRAMENTS_ROUTES)
      },
      {
        path: 'users',
        loadChildren: () => import('./features/users/users.routes').then(m => m.USERS_ROUTES)
      },
      {
        path: 'church-profile',
        loadChildren: () => import('./features/tenants/church-profile/church-profile.routes').then(m => m.CHURCH_PROFILE_ROUTES)
      },
      {
        path: 'families',
        component: FamilyListComponent
      },
      {
        path: 'families/:id',
        component: FamilyDetail,
        resolve: { breadcrumbLabel: FamilyBreadcrumbResolver }
      },
      {
        path: 'bccs',
        canActivate: [bccGuard],
        loadChildren: () => import('./features/bcc-management/bcc.routes').then((m) => m.BCC_ROUTES)
      },
      {
        path: 'donations',
        canActivate: [donationsGuard],
        loadChildren: () => import('./features/donations/donations.routes').then(m => m.DONATIONS_ROUTES)
      },
      {
        path: 'ministries',
        canActivate: [ministriesGuard],
        loadChildren: () =>
          import('./features/ministries-associations/ministries.routes').then(m => m.MINISTRIES_ROUTES)
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'auth/login'
  }
];

