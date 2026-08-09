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
import { SupportSessionService } from '@features/support-center/services/support-session.service';

export const ministriesGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const access = inject(SubscriptionAccessService);
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
      const isPlatformAdmin = authService.isSuperAdmin() || authService.isEkklesiaAdmin();
      const hasTenantContext = !!user.tenant_id || hasActiveSupportSession;

      if (isPlatformAdmin && !hasTenantContext) {
        void router.navigate(['/platform/ministries'], {
          queryParams: {
            notice: 'tenant_context_required',
            message:
              'Parish Ministries needs a parish context. Use Ministries Insights for platform analytics, or start a Support Center session to work in a parish.',
          },
        });
        return of(false);
      }

      if (!authService.canAccessMinistries(user, { hasActiveSupportSession })) {
        router.navigate(['/dashboard'], {
          queryParams: {
            error: 'forbidden',
            message: 'You do not have access to Ministries & Associations.',
          },
        });
        return of(false);
      }

      // Platform / support-elevated actors: feature entitlement is enforced by tenant APIs.
      if (!user.tenant_id || isPlatformAdmin) {
        return of(true);
      }

      access.ensureLoaded();
      return access.refresh().pipe(
        map(() => {
          if (access.allowsGatedAccess) {
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
