import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

/** Redirect users who must change their password before using the rest of the app. */
export const forcePasswordChangeGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return true;
  }

  if (authService.mustChangePassword()) {
    if (state.url.startsWith('/profile')) {
      return true;
    }

    router.navigate(['/profile'], { queryParams: { forcePassword: '1' } });
    return false;
  }

  return true;
};
