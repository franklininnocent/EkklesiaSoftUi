import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, catchError, switchMap, tap } from 'rxjs/operators';
import { AuthService } from '@core/services/auth.service';
import * as AuthActions from './auth.actions';
import * as TenantActions from '../tenant/tenant.actions';

@Injectable()
export class AuthEffects {
  private actions$ = inject(Actions);
  private authService = inject(AuthService);
  private router = inject(Router);

  login$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.login),
      tap(action => console.log('🔐 Login attempt for:', action.credentials.email)),
      switchMap(({ credentials }) =>
        this.authService.login(credentials).pipe(
          tap(response => console.log('✅ Login success:', response)),
          map(response => AuthActions.loginSuccess({ response })),
          catchError(error => {
            console.error('❌ Login failed:', error);
            return of(AuthActions.loginFailure({ error: error.message }));
          })
        )
      )
    )
  );

  loginSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.loginSuccess),
      tap((action) => {
        console.log('🎉 Login successful! Redirecting to dashboard...');
        console.log('📊 Token info:', {
          user_id: action.response.user_id,
          role_id: action.response.role_id,
          expiry_time: action.response.expiry_time
        });
        // Navigate to dashboard
        this.router.navigate(['/dashboard']);
      }),
      map(() => AuthActions.loadUser())
    )
  );

  register$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.register),
      switchMap(({ data }) =>
        this.authService.register(data).pipe(
          map(response => AuthActions.registerSuccess({ response })),
          catchError(error => of(AuthActions.registerFailure({ error: error.message })))
        )
      )
    )
  );

  registerSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.registerSuccess),
      tap(() => {
        console.log('🎉 Registration successful! Redirecting to dashboard...');
        this.router.navigate(['/dashboard']);
      }),
      map(() => AuthActions.loadUser())
    )
  );

  logout$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.logout),
      switchMap(() =>
        this.authService.logout().pipe(
          map(() => AuthActions.logoutSuccess()),
          catchError(() => of(AuthActions.logoutSuccess()))
        )
      )
    )
  );

  logoutSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.logoutSuccess),
      map(() => TenantActions.clearCurrentTenant())
    )
  );

  loadUser$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.loadUser),
      switchMap(() =>
        this.authService.getCurrentUser().pipe(
          tap(user => {
            console.log('👤 User loaded:', user);
            // Set tenant in store if user has tenant data
            if (user.tenant) {
              console.log('🏢 Setting current tenant:', user.tenant);
            }
          }),
          map(user => AuthActions.loadUserSuccess({ user })),
          catchError(error => of(AuthActions.loadUserFailure({ error: error.message })))
        )
      )
    )
  );

  loadUserSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.loadUserSuccess),
      switchMap(({ user }) => {
        // If user has tenant data, dispatch setCurrentTenant action
        if (user.tenant) {
          console.log('🏢 Dispatching setCurrentTenant:', user.tenant);
          return of(TenantActions.setCurrentTenant({ tenant: user.tenant }));
        }
        return of(); // Return empty observable if no tenant
      })
    )
  );

  loadUserFailure$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.loadUserFailure),
        tap(() => {
          console.error('❌ Failed to load user - clearing session');
          // Clear localStorage and redirect to login
          localStorage.clear();
          this.router.navigate(['/auth/login']);
        })
      ),
    { dispatch: false }
  );
}

