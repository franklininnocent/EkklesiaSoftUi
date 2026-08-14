import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter, take } from 'rxjs/operators';
import { of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { User } from '@core/models';
import { AuthService } from '@core/services/auth.service';
import { selectCurrentUser } from '@core/store/auth/auth.selectors';
import * as AuthActions from '@core/store/auth/auth.actions';
import { SupportSessionService } from '@features/support-center/services/support-session.service';

export const bccGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const store = inject(Store);
  const supportSessions = inject(SupportSessionService);

  if (!authService.isAuthenticated()) {
    router.navigate(['/auth/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  if (!authService.currentUserValue) {
    store.dispatch(AuthActions.loadUser());
  }

  return store.select(selectCurrentUser).pipe(
    filter((user): user is User => !!user),
    take(1),
    switchMap((user) => {
      const hasActiveSupportSession = !!supportSessions.sessionId;
      if (!authService.canAccessBcc(user, { hasActiveSupportSession })) {
        router.navigate(['/dashboard'], {
          queryParams: {
            error: 'forbidden',
            message: 'You do not have access to BCCs.',
          },
        });
        return of(false);
      }
      return of(true);
    })
  );
};
