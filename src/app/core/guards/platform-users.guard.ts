import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

/** Allows platform operators to manage Ekklesia staff without a parish support session. */
export const platformUsersGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/auth/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  const user = authService.currentUserValue;
  if (user && authService.isPlatformActor(user)) {
    return true;
  }

  router.navigate(['/dashboard']);
  return false;
};
