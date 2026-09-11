import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs/operators';
import { AuthService } from '@core/services/auth.service';

/**
 * Platform Application Access — Ekklesia role plus application_access.view.
 */
export const applicationAccessGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.currentUser$.pipe(
    take(1),
    map((user) => {
      if (!user) {
        router.navigate(['/auth/login'], { queryParams: { returnUrl: state.url } });
        return false;
      }

      if (authService.canAccessApplicationAccess(user)) {
        return true;
      }

      router.navigate(['/dashboard'], {
        queryParams: {
          error: 'forbidden',
          message: 'You do not have permission to view Application Access.',
        },
      });
      return false;
    })
  );
};
