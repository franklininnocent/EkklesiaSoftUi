import { Routes } from '@angular/router';

export const SACRAMENTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/sacrament-list/sacrament-list.component').then(m => m.SacramentListComponent)
  },
  {
    path: 'create',
    loadComponent: () => import('./components/sacrament-form/sacrament-form.component').then(m => m.SacramentFormComponent)
  },
  {
    path: 'edit/:id',
    loadComponent: () => import('./components/sacrament-form/sacrament-form.component').then(m => m.SacramentFormComponent)
  },
  {
    path: 'view/:id',
    loadComponent: () => import('./components/sacrament-detail/sacrament-detail.component').then(m => m.SacramentDetailComponent)
  }
];


