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
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '0c9b95' },
    body: JSON.stringify({
      sessionId: '0c9b95',
      location: 'auth.guard.ts',
      message: 'authGuard evaluated',
      data: { authenticated, targetUrl: state.url },
      hypothesisId: 'H3',
      timestamp: Date.now(),
      runId: 'app-load-debug',
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

