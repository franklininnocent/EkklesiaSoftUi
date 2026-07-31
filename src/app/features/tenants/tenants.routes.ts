import { Routes } from '@angular/router';
import { TenantManagerComponent } from './tenant-manager/tenant-manager';
import { TenantDetailComponent } from './tenant-detail/tenant-detail.component';

export const TENANTS_ROUTES: Routes = [
  {
    path: '',
    component: TenantManagerComponent
  },
  {
    path: ':id',
    component: TenantDetailComponent
  }
];

