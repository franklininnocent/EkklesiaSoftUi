import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { map, catchError, switchMap, tap, filter } from 'rxjs/operators';
import { AuthService } from '@core/services/auth.service';
import { AppState } from '@core/store';
import * as AuthActions from './auth.actions';
import * as TenantActions from '../tenant/tenant.actions';

@Injectable()
export class AuthEffects {
  private actions$ = inject(Actions);
  private authService = inject(AuthService);
  private router = inject(Router);
  private store = inject(Store<AppState>);

  /** Set before post-login/register user fetch; consumed after loadUserSuccess is in the store. */
  private postAuthRedirect: 'dashboard' | 'profile' | null = null;

  login$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.login),
      switchMap(({ credentials }) =>
        this.authService.login(credentials).pipe(
          map(response => AuthActions.loginSuccess({ response })),
          catchError(error => {
            console.error('Login failed:', error);
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
        this.postAuthRedirect = action.response.force_password_change ? 'profile' : 'dashboard';
      }),
      switchMap(() =>
        this.authService.getCurrentUser().pipe(
          tap((user) => this.authService.syncCurrentUser(user)),
          map((user) => AuthActions.loadUserSuccess({ user })),
          catchError((error) => {
            this.postAuthRedirect = null;
            console.error('Login succeeded but user load failed:', error);
            return of(
              AuthActions.loadUserFailure({
                error: error?.message || 'Failed to load user',
              })
            );
          })
        )
      )
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
        this.postAuthRedirect = 'dashboard';
      }),
      switchMap(() =>
        this.authService.getCurrentUser().pipe(
          tap((user) => this.authService.syncCurrentUser(user)),
          map((user) => AuthActions.loadUserSuccess({ user })),
          catchError((error) => {
            this.postAuthRedirect = null;
            return of(
              AuthActions.loadUserFailure({
                error: error?.message || 'Failed to load user',
              })
            );
          })
        )
      )
    )
  );

  /** Navigate only after loadUserSuccess reducer has populated the store. */
  navigateAfterAuthUserLoad$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.loadUserSuccess),
        filter(() => this.postAuthRedirect !== null),
        tap(({ user }) => {
          const redirect = this.postAuthRedirect;
          this.postAuthRedirect = null;
          // #region agent log
          fetch('http://127.0.0.1:7631/ingest/5401a346-7001-4033-9c37-4ee605985cd9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0c9b95'},body:JSON.stringify({sessionId:'0c9b95',location:'auth.effects.ts:navigateAfterAuthUserLoad$',message:'navigate after user in store',data:{redirect,userId:user?.id ?? null,tenantId:user?.tenant_id ?? null},hypothesisId:'H1',runId:'post-fix-v2',timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          if (redirect === 'profile') {
            this.router.navigate(['/profile'], { queryParams: { forcePassword: '1' } });
          } else if (redirect === 'dashboard') {
            this.router.navigate(['/dashboard']);
          }
        })
      ),
    { dispatch: false }
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
            this.authService.syncCurrentUser(user);
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
        // #region agent log
        fetch('http://127.0.0.1:7631/ingest/5401a346-7001-4033-9c37-4ee605985cd9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0c9b95'},body:JSON.stringify({sessionId:'0c9b95',location:'auth.effects.ts:loadUserSuccess$',message:'loadUserSuccess received',data:{userId:user?.id,tenantId:user?.tenant_id ?? null,href:typeof location!=='undefined'?location.href:null},hypothesisId:'H1',runId:'post-fix-v2',timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        if (user.tenant) {
          return of(TenantActions.setCurrentTenant({ tenant: user.tenant }));
        }
        return of();
      })
    )
  );

  loadUserFailure$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.loadUserFailure),
        tap(({ error }) => {
          const message = String(error || '');
          const isAuthFailure = /unauthorized|unauthenticated|401/i.test(message);
          const hasToken = !!this.authService.getToken();
          // #region agent log
          fetch('http://127.0.0.1:7631/ingest/5401a346-7001-4033-9c37-4ee605985cd9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0c9b95'},body:JSON.stringify({sessionId:'0c9b95',location:'auth.effects.ts:loadUserFailure$',message:'loadUserFailure handled',data:{error:message.slice(0,160),isAuthFailure,hasToken,willClearSession:isAuthFailure || !hasToken},hypothesisId:'H6',runId:'post-fix-v2',timestamp:Date.now()})}).catch(()=>{});
          // #endregion

          // Only wipe the session on real auth failures. Transient/network errors must not
          // bounce a freshly logged-in user back to login and clear their token.
          if (!isAuthFailure && hasToken) {
            console.error('Failed to load user - session kept:', error);
            return;
          }

          console.error('Failed to load user - clearing session');
          this.authService.clearAuthState();
          this.store.dispatch(AuthActions.logoutSuccess());
        })
      ),
    { dispatch: false }
  );
}
