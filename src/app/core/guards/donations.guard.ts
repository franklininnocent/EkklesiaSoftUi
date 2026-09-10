import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter, map, switchMap, take } from 'rxjs/operators';
import { of } from 'rxjs';
import { User } from '@core/models';
import { AuthService } from '@core/services/auth.service';
import { SubscriptionAccessService } from '@core/services/subscription-access.service';
import { selectCurrentUser } from '@core/store/auth/auth.selectors';
import * as AuthActions from '@core/store/auth/auth.actions';

export const donationsGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const access = inject(SubscriptionAccessService);
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
    switchMap((user) => {
      if (!authService.canAccessDonations(user)) {
        router.navigate(['/dashboard'], {
          queryParams: {
            error: 'forbidden',
            message: 'You do not have access to Donations.',
          },
        });
        return of(false);
      }

      // Platform admins without a tenant are not soft-gated here.
      if (!user.tenant_id || authService.isSuperAdmin() || authService.isEkklesiaAdmin()) {
        return of(true);
      }

      access.ensureLoaded();
      return access.refresh().pipe(
        map(() => {
          if (access.canViewGatedModules()) {
            return true;
          }
          const canViewSub = authService.canViewMySubscription(user);
          if (canViewSub) {
            router.navigate(['/settings/my-subscription'], {
              queryParams: { status: access.snapshot?.status || 'EXPIRED' },
            });
          } else {
            router.navigate(['/dashboard'], {
              queryParams: {
                error: 'subscription',
                message:
                  'Your subscription has ended or is suspended. Contact your administrator to restore access.',
              },
            });
          }
          return false;
        })
      );
    })
  );
};
