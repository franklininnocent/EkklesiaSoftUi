import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SupportSessionService } from '@features/support-center/services/support-session.service';

/**
 * Attaches the active support session id for TenantContext elevation on parish product APIs.
 * Header SSOT is validated server-side against support_sessions.
 *
 * Platform Support Center APIs (ops tickets, grants, audit, settings) must never receive
 * the header — ops identity stays platform-wide during diagnosis.
 */
export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
  const supportSessions = inject(SupportSessionService);
  const sessionId = supportSessions.sessionId;

  if (!sessionId || !shouldAttachSupportSessionHeader(req.url)) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: {
        'X-Support-Session-Id': sessionId,
      },
    })
  );
};

/** Paths that must not send elevation header. */
function shouldAttachSupportSessionHeader(url: string): boolean {
  const path = extractApiPath(url);

  if (!path.startsWith('/api/')) {
    return false;
  }

  if (path.startsWith('/api/support/')) {
    return shouldAttachForSupportPath(path);
  }

  return isParishProductApiPath(path);
}

function shouldAttachForSupportPath(path: string): boolean {
  if (path === '/api/support/sessions/active') {
    return false;
  }

  if (path === '/api/support/sessions') {
    return false;
  }

  if (/\/api\/support\/sessions\/[^/]+\/(end|force-end)$/.test(path)) {
    return false;
  }

  if (/\/api\/support\/sessions\/[^/]+\/events$/.test(path)) {
    return true;
  }

  return false;
}

function isParishProductApiPath(path: string): boolean {
  const prefixes = [
    '/api/tenant/',
    '/api/families',
    '/api/members',
    '/api/persons',
    '/api/sacraments',
    '/api/bcc',
    '/api/ministries',
    '/api/pastoral',
  ];

  return prefixes.some((prefix) => path === prefix || path.startsWith(prefix));
}

function extractApiPath(url: string): string {
  if (url.startsWith('/')) {
    return url.split('?')[0];
  }

  try {
    return new URL(url).pathname;
  } catch {
    return url.split('?')[0];
  }
}
