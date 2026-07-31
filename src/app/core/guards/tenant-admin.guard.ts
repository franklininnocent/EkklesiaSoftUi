import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { map, take } from 'rxjs/operators';
import { AppState } from '@core/store';
import { selectCurrentUser } from '@core/store/auth/auth.selectors';

/**
 * Guard to protect routes that should only be accessible by SuperAdmin and EkklesiaAdmin.
 * Tenant users will be redirected to the dashboard.
 */
export const tenantAdminGuard = () => {
  const store = inject(Store<AppState>);
  const router = inject(Router);

  return store.select(selectCurrentUser).pipe(
    take(1),
    map(user => {
      // No user, redirect to login (should not happen as auth guard runs first)
      if (!user) {
        router.navigate(['/auth/login']);
        return false;
      }

      // Check if user can manage tenants (SuperAdmin or EkklesiaAdmin)
      const canManageTenants = 
        user.role_name === 'SuperAdmin' || 
        user.role_name === 'EkklesiaAdmin' ||
        user.role?.name === 'SuperAdmin' || 
        user.role?.name === 'EkklesiaAdmin';

      if (canManageTenants) {
        return true; // Allow access
      }

      // Tenant users - redirect to dashboard
      console.warn('Access denied: Only SuperAdmin and EkklesiaAdmin can access this page');
      router.navigate(['/dashboard']);
      return false;
    })
  );
};

