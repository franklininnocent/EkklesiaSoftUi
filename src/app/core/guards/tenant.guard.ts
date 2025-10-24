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

  const currentTenant = tenantService.getCurrentTenant();
  
  // If we already have the correct tenant loaded, allow access
  if (currentTenant && currentTenant.id === parseInt(tenantId)) {
    if (tenantService.isTenantActive()) {
      return true;
    } else {
      router.navigate(['/auth/login'], { 
        queryParams: { error: 'Tenant is not active' }
      });
      return false;
    }
  }

  // Otherwise, load the tenant
  return tenantService.getTenant(parseInt(tenantId)).pipe(
    map(tenant => {
      if (tenantService.isTenantActive()) {
        return true;
      } else {
        router.navigate(['/auth/login'], { 
          queryParams: { error: 'Tenant is not active' }
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

