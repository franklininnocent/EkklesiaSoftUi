import { Routes } from '@angular/router';

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./settings.component').then(m => m.SettingsComponent)
  },
  {
    path: 'roles-permissions',
    loadComponent: () => import('./roles-permissions/roles-permissions.component').then(m => m.RolesPermissionsComponent)
  },
  {
    path: 'ecclesiastical',
    loadChildren: () => import('./ecclesiastical/ecclesiastical.routes').then(m => m.ECCLESIASTICAL_ROUTES)
  }
];

