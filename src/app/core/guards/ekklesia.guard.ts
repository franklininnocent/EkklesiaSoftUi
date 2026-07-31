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
 * 
 * Usage:
 * ```typescript
 * {
 *   path: 'ecclesiastical',
 *   canActivate: [ekklesiaGuard],
 *   component: EcclesiasticalComponent
 * }
 * ```
 */
export const ekklesiaGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.currentUser$.pipe(
    take(1),
    map(user => {
      // Check if user is logged in
      if (!user) {
        console.warn('Ekklesia Guard: No user logged in');
        router.navigate(['/auth/login'], {
          queryParams: { returnUrl: state.url }
        });
        return false;
      }

      // Check if user has Ekklesia role
      if (!user.has_ekklesia_role) {
        console.warn('Ekklesia Guard: User does not have Ekklesia role', {
          userId: user.id,
          userEmail: user.email,
          roleName: user.role_name,
          tenantId: user.tenant_id
        });
        
        router.navigate(['/dashboard'], {
          queryParams: { 
            error: 'forbidden',
            message: 'You do not have permission to access this area. Only Ekklesia administrators can access Ecclesiastical Data Management.'
          }
        });
        return false;
      }

      // User has Ekklesia role - allow access
      console.log('Ekklesia Guard: Access granted', {
        userId: user.id,
        userEmail: user.email,
        roleName: user.role_name
      });
      return true;
    })
  );
};

