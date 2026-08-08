import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs/operators';
import { AuthService } from '@core/services/auth.service';
import { canViewMySubscription } from '@shared/utils/subscription-access.util';

/**
 * Guard for Settings → My Subscription.
 * Mirrors API: subscription.view, primary/tenant admin, or platform admin with tenant.
 */
export const subscriptionViewGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.currentUser$.pipe(
    take(1),
    map((user) => {
      if (!user) {
        router.navigate(['/auth/login'], { queryParams: { returnUrl: state.url } });
        return false;
      }

      if (canViewMySubscription(user)) {
        return true;
      }

      const isPlatformAdmin =
        authService.isSuperAdmin() ||
        authService.isEkklesiaAdmin() ||
        user.role_name === 'SuperAdmin' ||
        user.role_name === 'EkklesiaAdmin' ||
        user.role?.name === 'SuperAdmin' ||
        user.role?.name === 'EkklesiaAdmin';

      router.navigate(['/dashboard'], {
        queryParams: {
          error: 'forbidden',
          message:
            isPlatformAdmin && !user.tenant_id
              ? 'My Subscription is available for church accounts.'
              : 'You do not have access to My Subscription.',
        },
      });
      return false;
    })
  );
};
