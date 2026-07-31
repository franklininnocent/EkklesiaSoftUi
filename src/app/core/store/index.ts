import { ActionReducerMap, MetaReducer } from '@ngrx/store';
import { environment } from '@environments/environment';
import { authReducer, AuthState } from './auth/auth.reducer';
import { tenantReducer, TenantState } from './tenant/tenant.reducer';

export interface AppState {
  auth: AuthState;
  tenant: TenantState;
}

export const reducers: ActionReducerMap<AppState> = {
  auth: authReducer,
  tenant: tenantReducer
};

export const metaReducers: MetaReducer<AppState>[] = !environment.production ? [] : [];

