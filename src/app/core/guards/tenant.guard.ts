import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot } from '@angular/router';
import { TenantService } from '@core/services/tenant.service';
import { map, catchError, of } from 'rxjs';

export const tenantGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const tenantService = inject(TenantService);
  const router = inject(Router);
  
  const tenantId = route.paramMap.get('tenantId');
  
  if (!tenantId) {
    router.navigate(['/auth/login']);
    return false;
  }

  // Load and validate tenant
  return tenantService.getTenant(parseInt(tenantId)).pipe(
    map(response => {
      if (response.success && response.data) {
        // Check if tenant is active
        if (response.data.active === 1) {
          return true;
        } else {
          router.navigate(['/auth/login'], { 
            queryParams: { error: 'Tenant is not active' }
          });
          return false;
        }
      } else {
        router.navigate(['/auth/login'], { 
          queryParams: { error: 'Invalid tenant' }
        });
        return false;
      }
    }),
    catchError(() => {
      router.navigate(['/auth/login'], { 
        queryParams: { error: 'Invalid tenant' }
      });
      return of(false);
    })
  );
};

