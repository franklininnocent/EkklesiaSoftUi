import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const authenticated = authService.isAuthenticated();
  // #region agent log
  fetch('http://127.0.0.1:7631/ingest/5401a346-7001-4033-9c37-4ee605985cd9', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'ae66ec' },
    body: JSON.stringify({
      sessionId: 'ae66ec',
      runId: 'pre-fix',
      hypothesisId: 'B',
      location: 'auth.guard.ts',
      message: 'authGuard',
      data: { url: state.url, authenticated },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  if (authenticated) {
    return true;
  }

  // Store the attempted URL for redirecting
  router.navigate(['/auth/login'], { 
    queryParams: { returnUrl: state.url }
  });
  return false;
};

