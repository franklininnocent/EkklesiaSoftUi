import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter, map, take } from 'rxjs/operators';
import { User } from '@core/models';
import { ApplicationContextService } from '@core/services/application-context.service';
import { AuthService } from '@core/services/auth.service';
import { selectCurrentUser } from '@core/store/auth/auth.selectors';
import * as AuthActions from '@core/store/auth/auth.actions';

/**
 * Blocks platform operators from parish product routes without home tenant or Support overlay.
 */
export const parishResourceGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const appContext = inject(ApplicationContextService);
  const router = inject(Router);
  const store = inject(Store);

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
    map((user) => {
      if (appContext.hasParishResourceContext(user)) {
        return true;
      }

      if (authService.isPlatformActor(user)) {
        router.navigate(['/dashboard'], {
          queryParams: {
            notice: 'support_session_required',
            message: 'Start a Support Center session to work in a parish.',
            returnUrl: state.url,
          },
        });
        return false;
      }

      router.navigate(['/dashboard']);
      return false;
    })
  );
};
