import { HttpInterceptorFn, HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { ConfirmationDialogService } from '@core/services/confirmation-dialog.service';
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

function isPublicPasswordRecoveryRequest(url: string): boolean {
  return url.includes('/auth/password/recovery/request');
}

let planLimitDialogOpen = false;

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const toast = inject(ToastService);
  const auth = inject(AuthService);
  const supportSessions = inject(SupportSessionService);
  const dialogs = inject(ConfirmationDialogService);

  const showPlanLimitDialog = (message: string, limit: unknown, usage: unknown): void => {
    if (planLimitDialogOpen) return;
    planLimitDialogOpen = true;
    const canSeePlan = auth.canViewMySubscription();
    const usageLine =
      typeof usage === 'number' && typeof limit === 'number' ? ` Your church is using ${usage} of ${limit}.` : '';
    dialogs
      .confirm({
        title: 'Plan limit reached',
        message:
          `${message}${usageLine} ` +
          (canSeePlan
            ? 'You can see plan options and request an upgrade from My Subscription.'
            : 'Please ask your church administrator about a larger plan.'),
        confirmText: canSeePlan ? 'See plan options' : 'OK',
        cancelText: canSeePlan ? 'Not now' : 'Close',
      })
      .subscribe((result) => {
        planLimitDialogOpen = false;
        if (result.confirmed && canSeePlan) {
          void router.navigate(['/settings/my-subscription']);
        }
      });
  };

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
            if (
              !req.url.includes('/auth/logout') &&
              !req.url.includes('/auth/login') &&
              !isPublicPasswordRecoveryRequest(req.url)
            ) {
              auth.clearAuthState();
            }
            break;
          case 403:
            if (code === 'FEATURE_NOT_AVAILABLE') {
              errorMessage = error.error?.message || 'This feature is not included in your current plan.';
              toast.warning(errorMessage, 'Not in your plan');
            } else if (code === 'ENTITLEMENT_LIMIT_REACHED') {
              errorMessage = error.error?.message || 'Your current plan limit has been reached.';
              showPlanLimitDialog(errorMessage, error.error?.limit, error.error?.current_usage);
            } else if (reason === 'subscription_blocked' || code === 'SUBSCRIPTION_READ_ONLY' || code === 'SUBSCRIPTION_EXPIRED') {
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
        feature: error.error?.feature as string | undefined,
        limit: error.error?.limit as number | undefined,
        current_usage: error.error?.current_usage as number | undefined,
      }));
    })
  );
};
