import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TenantService } from '@core/services/tenant.service';

export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
  const tenantService = inject(TenantService);
  const tenantId = tenantService.getCurrentTenantId();

  if (tenantId) {
    const clonedRequest = req.clone({
      setHeaders: {
        'X-Tenant-ID': tenantId.toString()
      }
    });
    return next(clonedRequest);
  }

  return next(req);
};

