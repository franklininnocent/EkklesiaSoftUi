import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SupportSessionService } from '@features/support-center/services/support-session.service';

/**
 * Attaches the active support session id for TenantContext elevation.
 * Header SSOT is validated server-side against support_sessions.
 */
export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
  const supportSessions = inject(SupportSessionService);
  const sessionId = supportSessions.sessionId;

  if (!sessionId) {
    return next(req);
  }

  // Do not attach when calling support session bootstrap endpoints that don't need elevation context.
  // Still attach for consistency; server ignores on /api/support/* for mode enforcement.
  return next(
    req.clone({
      setHeaders: {
        'X-Support-Session-Id': sessionId,
      },
    })
  );
};
