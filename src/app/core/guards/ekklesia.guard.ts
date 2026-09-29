import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { map, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

/**
 * Ekklesia Route Guard
 *
 * Protects routes that should only be accessible to Ekklesia users
 * (SuperAdmin, EkklesiaAdmin, EkklesiaManager, EkklesiaUser).
 *
 * Tenant users, regardless of their roles/permissions, are blocked.
 */
export const ekklesiaGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.currentUser$.pipe(
    take(1),
    map(user => {
      if (!user) {
        router.navigate(['/auth/login'], {
          queryParams: { returnUrl: state.url }
        });
        return false;
      }

      if (!authService.hasEkklesiaRole(user)) {
        router.navigate(['/dashboard'], {
          queryParams: {
            error: 'forbidden',
            message: 'You do not have permission to access this area. Only Ekklesia administrators can access Ecclesiastical Data Management.'
          }
        });
        return false;
      }

      return true;
    })
  );
};
