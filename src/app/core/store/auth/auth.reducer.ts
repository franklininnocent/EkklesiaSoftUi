import { createReducer, on } from '@ngrx/store';
import { User } from '@core/models';
import * as AuthActions from './auth.actions';
import { environment } from '@environments/environment';

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

// Helper functions to get initial state from localStorage
function getStoredToken(): string | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return localStorage.getItem(environment.tokenKey);
  }
  return null;
}

function getStoredUser(): User | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    const userStr = localStorage.getItem(environment.userKey);
    return userStr ? JSON.parse(userStr) : null;
  }
  return null;
}

export function createEmptyAuthState(): AuthState {
  return {
    user: null,
    token: null,
    isAuthenticated: false,
    loading: false,
    error: null,
  };
}

export const initialState: AuthState = {
  ...createEmptyAuthState(),
  user: getStoredUser(),
  token: getStoredToken(),
  isAuthenticated: !!getStoredToken(),
};

export const authReducer = createReducer(
  initialState,
  
  // Login
  on(AuthActions.login, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  
  on(AuthActions.loginSuccess, (state, { response }) => ({
    ...state,
    user: null, // User will be loaded separately via getCurrentUser()
    token: response.access_token,
    isAuthenticated: true,
    loading: false,
    error: null
  })),
  
  on(AuthActions.loginFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),
  
  // Register
  on(AuthActions.register, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  
  on(AuthActions.registerSuccess, (state, { response }) => ({
    ...state,
    user: null, // User will be loaded separately via getCurrentUser()
    token: response.access_token,
    isAuthenticated: true,
    loading: false,
    error: null
  })),
  
  on(AuthActions.registerFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),
  
  // Logout
  on(AuthActions.logout, () => createEmptyAuthState()),

  on(AuthActions.logoutSuccess, () => createEmptyAuthState()),
  
  on(AuthActions.logoutFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),
  
  // Load User
  on(AuthActions.loadUser, (state) => ({
    ...state,
    loading: true
  })),
  
  on(AuthActions.loadUserSuccess, (state, { user }) => ({
    ...state,
    user,
    isAuthenticated: true,
    loading: false
  })),
  
  on(AuthActions.loadUserFailure, (state, { error }) => ({
    ...state,
    user: null,
    token: null,
    isAuthenticated: false,
    loading: false,
    error
  })),
  
  // Clear Error
  on(AuthActions.clearAuthError, (state) => ({
    ...state,
    error: null
  }))
);

