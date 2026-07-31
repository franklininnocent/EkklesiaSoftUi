import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs/operators';
import { AuthService } from '@core/services/auth.service';

/**
 * RBAC guard for Roles & Permissions UI.
 * Allows platform admins or tenant admins with at least view permission.
 */
export const rbacGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.currentUser$.pipe(
    take(1),
    map((user) => {
      if (!user) {
        router.navigate(['/auth/login'], { queryParams: { returnUrl: state.url } });
        return false;
      }

      if (authService.canAccessRbac(user)) {
        return true;
      }

      router.navigate(['/dashboard'], {
        queryParams: {
          error: 'forbidden',
          message: 'You do not have access to Roles and Permissions.'
        }
      });
      return false;
    })
  );
};

