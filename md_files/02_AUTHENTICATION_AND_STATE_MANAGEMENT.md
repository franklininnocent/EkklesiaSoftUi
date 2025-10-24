# 🔐 Authentication & State Management

**EkklesiaSoft Frontend** - Complete Auth & NgRx Implementation

---

## 📚 Contents

1. [Authentication Flow](#authentication-flow)
2. [Login Implementation](#login-implementation)
3. [NgRx State Management](#ngrx-state-management)
4. [HTTP Interceptors](#http-interceptors)
5. [Route Guards](#route-guards)
6. [Token Management](#token-management)

---

## 🔄 Authentication Flow

```
User Login → API Call → Store Token → Redirect Dashboard
    ↓
Access Protected Route → Guard Check → Allow/Deny
    ↓
API Call → Interceptor → Add Bearer Token
    ↓
Token Expired → Auto Refresh → Retry Request
    ↓
Logout → Revoke Token → Clear Storage → Redirect Login
```

---

## 🚪 Login Implementation

### Login Component

**Location:** `src/app/features/auth/login/login.component.ts`

```typescript
export class LoginComponent {
  private store = inject(Store);
  email = '';
  password = '';
  
  onSubmit() {
    if (this.email && this.password) {
      this.store.dispatch(AuthActions.login({
        email: this.email,
        password: this.password
      }));
    }
  }
}
```

### Login Template

```html
<form (ngSubmit)="onSubmit()">
  <input [(ngModel)]="email" type="email" required>
  <input [(ngModel)]="password" type="password" required>
  <button type="submit">Login</button>
</form>
```

---

## 🏪 NgRx State Management

### Auth State Structure

```typescript
// auth.state.ts
export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  expiryTime: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}
```

### Actions

```typescript
// auth.actions.ts
export const login = createAction(
  '[Auth] Login',
  props<{ email: string; password: string }>()
);

export const loginSuccess = createAction(
  '[Auth] Login Success',
  props<{ response: AuthResponse }>()
);

export const loginFailure = createAction(
  '[Auth] Login Failure',
  props<{ error: string }>()
);

export const logout = createAction('[Auth] Logout');

export const loadUser = createAction('[Auth] Load User');

export const loadUserSuccess = createAction(
  '[Auth] Load User Success',
  props<{ user: User }>()
);

export const refreshTokens = createAction('[Auth] Refresh Tokens');
```

### Reducer

```typescript
// auth.reducer.ts
export const authReducer = createReducer(
  initialState,
  on(AuthActions.login, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  on(AuthActions.loginSuccess, (state, { response }) => ({
    ...state,
    token: response.access_token,
    refreshToken: response.refresh_token,
    expiryTime: response.expiry_time,
    isAuthenticated: true,
    loading: false
  })),
  on(AuthActions.logout, () => initialState)
);
```

### Effects

```typescript
// auth.effects.ts
login$ = createEffect(() =>
  this.actions$.pipe(
    ofType(AuthActions.login),
    switchMap(({ email, password }) =>
      this.authService.login(email, password).pipe(
        map(response => AuthActions.loginSuccess({ response })),
        catchError(error => of(AuthActions.loginFailure({ error })))
      )
    )
  )
);

loginSuccess$ = createEffect(() =>
  this.actions$.pipe(
    ofType(AuthActions.loginSuccess),
    tap(() => {
      this.router.navigate(['/dashboard']);
      this.store.dispatch(AuthActions.loadUser());
    })
  ),
  { dispatch: false }
);
```

### Selectors

```typescript
// auth.selectors.ts
export const selectAuthState = createFeatureSelector<AuthState>('auth');

export const selectCurrentUser = createSelector(
  selectAuthState,
  (state) => state.user
);

export const selectIsAuthenticated = createSelector(
  selectAuthState,
  (state) => state.isAuthenticated
);

export const selectAuthToken = createSelector(
  selectAuthState,
  (state) => state.token
);
```

---

## 🔒 HTTP Interceptors

### Auth Interceptor

**Location:** `src/app/core/interceptors/auth.interceptor.ts`

```typescript
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem(environment.tokenKey);
  
  if (token && !req.url.includes('/auth/login')) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }
  
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        // Try refresh token
        return refreshTokenAndRetry(req, next);
      }
      return throwError(() => error);
    })
  );
};
```

### Error Interceptor

```typescript
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let errorMessage = 'An error occurred';
      
      if (error.error instanceof ErrorEvent) {
        errorMessage = error.error.message;
      } else {
        errorMessage = error.error?.message || error.message;
      }
      
      // Show toast notification
      inject(ToastService).error(errorMessage);
      
      return throwError(() => new Error(errorMessage));
    })
  );
};
```

---

## 🛡️ Route Guards

### Auth Guard

```typescript
export const authGuard: CanActivateFn = (route, state) => {
  const store = inject(Store);
  const router = inject(Router);
  
  return store.select(selectIsAuthenticated).pipe(
    take(1),
    map(isAuthenticated => {
      if (isAuthenticated) {
        return true;
      }
      router.navigate(['/auth/login']);
      return false;
    })
  );
};
```

### Usage in Routes

```typescript
export const routes: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', loadChildren: () => import('./features/dashboard') },
      { path: 'tenants', loadChildren: () => import('./features/tenants') }
    ]
  }
];
```

---

## 🎫 Token Management

### Auth Service

```typescript
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  
  login(email: string, password: string) {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, {
      email, password
    }).pipe(
      tap(response => {
        this.storeTokens(response);
      })
    );
  }
  
  private storeTokens(response: AuthResponse) {
    localStorage.setItem(environment.tokenKey, response.access_token);
    localStorage.setItem(environment.refreshTokenKey, response.refresh_token);
    localStorage.setItem(environment.expiryTimeKey, response.expiry_time);
    localStorage.setItem(environment.userIdKey, String(response.user_id));
    localStorage.setItem(environment.roleIdKey, String(response.role_id));
  }
  
  refreshTokens() {
    const refreshToken = localStorage.getItem(environment.refreshTokenKey);
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/refresh`, {
      refresh_token: refreshToken
    }).pipe(
      tap(response => {
        this.storeTokens(response);
      })
    );
  }
  
  logout() {
    return this.http.post(`${environment.apiUrl}/auth/logout`, {}).pipe(
      tap(() => {
        localStorage.clear();
      })
    );
  }
  
  getCurrentUser() {
    return this.http.get<UserResponse>(`${environment.apiUrl}/auth/get-user`);
  }
}
```

---

## ✅ Page Refresh Fix

**Problem:** User data disappeared on page refresh

**Solution:** Load state from localStorage on app init

```typescript
// auth.reducer.ts
const storedToken = localStorage.getItem(environment.tokenKey);
const storedUser = localStorage.getItem(environment.userKey);

export const initialState: AuthState = {
  token: storedToken,
  user: storedUser ? JSON.parse(storedUser) : null,
  isAuthenticated: !!storedToken,
  // ... other properties
};

// main-layout.component.ts
ngOnInit() {
  this.currentUser$.pipe(take(1)).subscribe(user => {
    if (!user && this.isAuthenticated) {
      this.store.dispatch(AuthActions.loadUser());
    }
  });
}
```

---

## 🔧 SuperAdmin Implementation

### Check User Role

```typescript
// In component
isSuperAdmin$ = this.store.select(selectCurrentUser).pipe(
  map(user => user?.role_id === 1)
);

// In template
<div *ngIf="isSuperAdmin$ | async">
  <button>Admin Only Feature</button>
</div>
```

---

**Last Updated:** October 24, 2025  
**See also:** `01_SETUP_ARCHITECTURE_AND_PROJECT.md`, `06_TROUBLESHOOTING_AND_DEBUGGING.md`
