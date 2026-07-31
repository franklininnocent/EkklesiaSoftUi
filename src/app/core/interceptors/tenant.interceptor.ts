import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TenantService } from '@core/services/tenant.service';

export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
  // TODO: Implement tenant context when multi-tenancy is fully implemented
  // For now, pass through all requests without modification
  
  // Future implementation:
  // const tenantService = inject(TenantService);
  // const tenantId = getCurrentTenantFromContext();
  // if (tenantId) {
  //   const clonedRequest = req.clone({
  //     setHeaders: { 'X-Tenant-ID': tenantId.toString() }
  //   });
  //   return next(clonedRequest);
  // }

  return next(req);
};

