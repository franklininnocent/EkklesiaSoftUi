import { HttpInterceptorFn, HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { SupportSessionService } from '@features/support-center/services/support-session.service';

function isSupportSessionAuthFailure(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('support session') ||
    normalized.includes('invalid support session') ||
    normalized.includes('session header does not match')
  );
}

function requestSupportSessionId(req: HttpRequest<unknown>): string | null {
  const headerId = req.headers.get('X-Support-Session-Id');
  if (headerId) {
    return headerId;
  }

  const match = /\/support\/sessions\/([^/]+)\/events/.exec(req.url);
  return match ? match[1] : null;
}

function isSupportSessionEventsRequest(url: string): boolean {
  return /\/support\/sessions\/[^/]+\/events/.test(url);
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const toast = inject(ToastService);
  const auth = inject(AuthService);
  const supportSessions = inject(SupportSessionService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let errorMessage = 'An unknown error occurred';
      const reason = error.error?.reason as string | undefined;
      const code = error.error?.code as string | undefined;
      const subscriptionStatus = error.error?.subscription_status as string | undefined;

      if (error.error instanceof ErrorEvent) {
        errorMessage = 'A network error occurred while processing your request. Please try again.';
      } else {
        switch (error.status) {
          case 0:
            errorMessage = 'Unable to reach the server right now. Please check your internet connection and try again.';
            break;
          case 400:
            errorMessage = error.error?.message || 'Bad Request';
            break;
          case 401:
            errorMessage = 'Unauthorized. Please login again.';
            if (!req.url.includes('/auth/logout') && !req.url.includes('/auth/login')) {
              auth.clearAuthState();
            }
            break;
          case 403:
            if (reason === 'subscription_blocked' || code === 'SUBSCRIPTION_READ_ONLY') {
              errorMessage =
                error.error?.message ||
                'Your subscription has ended. You can view records, but you cannot save changes.';
              toast.error(errorMessage, 'Read-only');
            } else {
              errorMessage = error.error?.message || 'Forbidden. You do not have permission.';
              if (isSupportSessionAuthFailure(errorMessage)) {
                const invalidated = supportSessions.invalidateIfMatchesCurrent(
                  requestSupportSessionId(req)
                );
                if (invalidated && !isSupportSessionEventsRequest(req.url)) {
                  toast.error(
                    'Your support session is no longer valid. Start a new session from Support Center.',
                    'Support session ended'
                  );
                  if (!req.url.includes('/support-center')) {
                    void router.navigate(['/support-center']);
                  }
                }
              }
            }
            break;
          case 404:
            errorMessage = 'Resource not found';
            break;
          case 422:
            errorMessage = error.error?.message || 'Validation error';
            break;
          case 500:
            errorMessage = 'Internal server error. Please try again later.';
            break;
          default:
            errorMessage = error.error?.message || 'Something went wrong. Please try again.';
        }
      }

      console.error('HTTP Error:', errorMessage, error);

      return throwError(() => ({
        message: errorMessage,
        status: error.status,
        errors: error.error?.errors,
        code: error.error?.code,
        context: error.error?.context,
        reason,
        subscription_status: subscriptionStatus,
      }));
    })
  );
};
