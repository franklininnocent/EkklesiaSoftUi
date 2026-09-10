import { Routes, Router, ActivatedRouteSnapshot, UrlTree } from '@angular/router';
import { inject } from '@angular/core';
import { tenantReadOnlyBlockGuard } from '@core/guards/tenant-read-only.guard';

/**
 * Legacy /create and /edit/:id redirect to the registry list, which opens
 * the XL sacrament-form-modal (sole create/edit path for non–Holy Orders).
 */
function redirectLegacySacramentForm(route: ActivatedRouteSnapshot): UrlTree {
  const router = inject(Router);
  const id = route.paramMap.get('id');
  if (id) {
    return router.createUrlTree(['/sacraments/register'], {
      queryParams: { edit: id },
    });
  }
  return router.createUrlTree(['/sacraments/register'], {
    queryParams: { create: '1' },
  });
}

export const SACRAMENTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/sacraments-dashboard/sacraments-dashboard.component').then(
        (m) => m.SacramentsDashboardComponent
      ),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./components/sacrament-list/sacrament-list.component').then(
        (m) => m.SacramentListComponent
      ),
  },
  {
    path: 'migration',
    loadComponent: () =>
      import('./components/migration-queue/sacrament-migration-queue.component').then(
        (m) => m.SacramentMigrationQueueComponent
      ),
  },
  {
    path: 'holy-orders/create',
    canActivate: [tenantReadOnlyBlockGuard],
    loadComponent: () =>
      import('./components/holy-orders-form/holy-orders-form.component').then(
        (m) => m.HolyOrdersFormComponent
      ),
  },
  {
    path: 'create',
    canActivate: [redirectLegacySacramentForm],
    children: [],
  },
  {
    path: 'edit/:id',
    canActivate: [redirectLegacySacramentForm],
    children: [],
  },
  {
    path: 'view/:id',
    loadComponent: () =>
      import('./components/sacrament-detail/sacrament-detail.component').then(
        (m) => m.SacramentDetailComponent
      ),
  },
];
