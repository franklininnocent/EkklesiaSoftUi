import { createAction, props } from '@ngrx/store';
import { Tenant } from '@core/models';

// Load Tenants
export const loadTenants = createAction('[Tenant] Load Tenants');

export const loadTenantsSuccess = createAction(
  '[Tenant] Load Tenants Success',
  props<{ tenants: Tenant[] }>()
);

export const loadTenantsFailure = createAction(
  '[Tenant] Load Tenants Failure',
  props<{ error: string }>()
);

// Load Single Tenant
export const loadTenant = createAction(
  '[Tenant] Load Tenant',
  props<{ tenantId: number }>()
);

export const loadTenantSuccess = createAction(
  '[Tenant] Load Tenant Success',
  props<{ tenant: Tenant }>()
);

export const loadTenantFailure = createAction(
  '[Tenant] Load Tenant Failure',
  props<{ error: string }>()
);

// Set Current Tenant
export const setCurrentTenant = createAction(
  '[Tenant] Set Current Tenant',
  props<{ tenant: Tenant }>()
);

export const clearCurrentTenant = createAction('[Tenant] Clear Current Tenant');

// Clear Error
export const clearTenantError = createAction('[Tenant] Clear Error');

