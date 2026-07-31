import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let errorMessage = 'An unknown error occurred';

      if (error.error instanceof ErrorEvent) {
        // Client-side error
        errorMessage = 'A network error occurred while processing your request. Please try again.';
      } else {
        // Server-side error
        switch (error.status) {
          case 0:
            errorMessage = 'Unable to reach the server right now. Please check your internet connection and try again.';
            break;
          case 400:
            errorMessage = error.error?.message || 'Bad Request';
            break;
          case 401:
            errorMessage = 'Unauthorized. Please login again.';
            if (!req.url.includes('/auth/logout')) {
              router.navigate(['/auth/login']);
            }
            break;
          case 403:
            errorMessage = 'Forbidden. You do not have permission.';
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
        errors: error.error?.errors
      }));
    })
  );
};

