import { createFeatureSelector, createSelector } from '@ngrx/store';
import { TenantState } from './tenant.reducer';

export const selectTenantState = createFeatureSelector<TenantState>('tenant');

export const selectCurrentTenant = createSelector(
  selectTenantState,
  (state) => state.currentTenant
);

export const selectAllTenants = createSelector(
  selectTenantState,
  (state) => state.tenants
);

export const selectTenantLoading = createSelector(
  selectTenantState,
  (state) => state.loading
);

export const selectTenantError = createSelector(
  selectTenantState,
  (state) => state.error
);

export const selectCurrentTenantId = createSelector(
  selectCurrentTenant,
  (tenant) => tenant?.id ?? null
);

export const selectCurrentTenantStatus = createSelector(
  selectCurrentTenant,
  (tenant) => tenant?.status ?? null
);

