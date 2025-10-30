import { Routes } from '@angular/router';
import { ekklesiaGuard } from '@core/guards/ekklesia.guard';

export const ECCLESIASTICAL_ROUTES: Routes = [
  {
    path: '',
    canActivate: [ekklesiaGuard],
    loadComponent: () => import('./ecclesiastical.component')
      .then(m => m.EcclesiasticalComponent),
    children: [
      {
        path: '',
        redirectTo: 'overview',
        pathMatch: 'full'
      },
      {
        path: 'overview',
        loadComponent: () => import('./overview/overview.component')
          .then(m => m.EcclesiasticalOverviewComponent)
      },
      {
        path: 'dioceses',
        loadComponent: () => import('./dioceses/diocese-list/diocese-list.component')
          .then(m => m.DioceseListComponent)
      },
      {
        path: 'dioceses/:id',
        loadComponent: () => import('./dioceses/diocese-detail/diocese-detail.component')
          .then(m => m.DioceseDetailComponent)
      },
      {
        path: 'bishops',
        loadComponent: () => import('./bishops/bishop-list/bishop-list.component')
          .then(m => m.BishopListComponent)
      },
      {
        path: 'bishops/:id',
        loadComponent: () => import('./bishops/bishop-detail/bishop-detail.component')
          .then(m => m.BishopDetailComponent)
      },
      {
        path: 'sacrament-types',
        loadComponent: () => import('./sacrament-types/components/sacrament-type-list/sacrament-type-list.component')
          .then(m => m.SacramentTypeListComponent)
      }
    ]
  }
];

