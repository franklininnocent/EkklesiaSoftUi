import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { map, take } from 'rxjs/operators';
import { AppState } from '@core/store';
import { AuthService } from '@core/services/auth.service';
import { selectCurrentUser } from '@core/store/auth/auth.selectors';

/**
 * Guard for platform tenant administration routes (Tenants, Ministries Insights).
 */
export const tenantAdminGuard = () => {
  const store = inject(Store<AppState>);
  const router = inject(Router);
  const authService = inject(AuthService);

  return store.select(selectCurrentUser).pipe(
    take(1),
    map((user) => {
      if (!user) {
        router.navigate(['/auth/login']);
        return false;
      }

      if (authService.canManageTenants(user)) {
        return true;
      }

      router.navigate(['/dashboard']);
      return false;
    })
  );
};
