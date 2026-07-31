import { createReducer, on } from '@ngrx/store';
import { Tenant } from '@core/models';
import * as TenantActions from './tenant.actions';

export interface TenantState {
  currentTenant: Tenant | null;
  tenants: Tenant[];
  loading: boolean;
  error: string | null;
}

export const initialState: TenantState = {
  currentTenant: null,
  tenants: [],
  loading: false,
  error: null
};

export const tenantReducer = createReducer(
  initialState,
  
  // Load Tenants
  on(TenantActions.loadTenants, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  
  on(TenantActions.loadTenantsSuccess, (state, { tenants }) => ({
    ...state,
    tenants,
    loading: false,
    error: null
  })),
  
  on(TenantActions.loadTenantsFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),
  
  // Load Single Tenant
  on(TenantActions.loadTenant, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  
  on(TenantActions.loadTenantSuccess, (state, { tenant }) => ({
    ...state,
    currentTenant: tenant,
    loading: false,
    error: null
  })),
  
  on(TenantActions.loadTenantFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),
  
  // Set/Clear Current Tenant
  on(TenantActions.setCurrentTenant, (state, { tenant }) => ({
    ...state,
    currentTenant: tenant
  })),
  
  on(TenantActions.clearCurrentTenant, (state) => ({
    ...state,
    currentTenant: null
  })),
  
  // Clear Error
  on(TenantActions.clearTenantError, (state) => ({
    ...state,
    error: null
  }))
);

