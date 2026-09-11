import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs/operators';
import { AuthService } from '@core/services/auth.service';

/**
 * Protects Support Center routes for platform support staff (any Ekklesia role
 * with support permissions), not only SuperAdmin / EkklesiaAdmin.
 */
export const supportCenterGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.currentUser$.pipe(
    take(1),
    map((user) => {
      if (!user) {
        router.navigate(['/auth/login'], { queryParams: { returnUrl: state.url } });
        return false;
      }

      if (authService.canAccessSupportCenter(user)) {
        return true;
      }

      router.navigate(['/dashboard'], {
        queryParams: {
          error: 'forbidden',
          message: 'You do not have permission to use Support Center.',
        },
      });
      return false;
    })
  );
};
