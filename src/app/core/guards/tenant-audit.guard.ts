import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { map, take } from 'rxjs/operators';
import { AppState } from '@core/store';
import { AuthService } from '@core/services/auth.service';
import { selectCurrentUser } from '@core/store/auth/auth.selectors';

/** Parish module audit log pages (BCC, Ministries). */
export const tenantAuditGuard = () => {
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

      if (authService.canViewTenantAuditLogs(user)) {
        return true;
      }

      const fallback = user.tenant_id ? '/dashboard' : '/dashboard';
      router.navigate([fallback]);
      return false;
    })
  );
};
