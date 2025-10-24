import { Routes } from '@angular/router';
import { TenantManagerComponent } from './tenant-manager/tenant-manager';

export const TENANTS_ROUTES: Routes = [
  {
    path: '',
    component: TenantManagerComponent
  }
];

