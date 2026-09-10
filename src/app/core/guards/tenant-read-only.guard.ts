import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs/operators';
import { SubscriptionAccessService } from '@core/services/subscription-access.service';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';

/**
 * Blocks navigation into create/edit workflows when parish is read-only.
 * View routes remain reachable; API is the enforcement layer.
 */
export const tenantReadOnlyBlockGuard: CanActivateFn = () => {
  const access = inject(SubscriptionAccessService);
  const auth = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);

  if (!auth.currentUserValue?.tenant_id) {
    return true;
  }

  access.ensureLoaded();

  return access.refresh().pipe(
    take(1),
    map(() => {
      if (!access.isReadOnly()) {
        return true;
      }
      toast.warning('Read-only mode: you cannot save changes until the subscription is renewed.', 'Read-only');
      router.navigate(['/dashboard']);
      return false;
    })
  );
};
