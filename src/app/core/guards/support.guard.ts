import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs/operators';
import { AuthService } from '@core/services/auth.service';

export const supportGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.currentUser$.pipe(
    take(1),
    map((user) => {
      if (!user) {
        router.navigate(['/auth/login'], { queryParams: { returnUrl: state.url } });
        return false;
      }

      if (!authService.canAccessSupport(user)) {
        router.navigate(['/dashboard'], {
          queryParams: {
            error: 'forbidden',
            message: 'You do not have access to Support.',
          },
        });
        return false;
      }

      return true;
    })
  );
};
