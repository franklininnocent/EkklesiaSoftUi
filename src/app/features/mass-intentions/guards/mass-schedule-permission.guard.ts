import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { canScheduleMasses } from '../utils/mass-intentions-auth.util';

export const massSchedulePermissionGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (canScheduleMasses(auth)) {
    return true;
  }
  return router.createUrlTree(['/mass-intentions/masses'], {
    queryParams: { schedule_denied: '1' },
  });
};
