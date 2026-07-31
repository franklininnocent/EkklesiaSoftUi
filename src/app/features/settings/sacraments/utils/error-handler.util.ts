/**
 * Error Handler Utility
 * Standardized error handling for Sacraments module
 */

import { HttpErrorResponse } from '@angular/common/http';

export interface ErrorDetails {
  message: string;
  code?: string;
  field?: string;
  details?: Record<string, unknown>;
}

/**
 * Extract error message from HTTP error response
 */
export function extractErrorMessage(error: HttpErrorResponse | Error | unknown): string {
  if (error instanceof HttpErrorResponse) {
    // Backend error with structured response
    if (error.error?.message) {
      return error.error.message;
    }
    
    // Validation errors
    if (error.error?.errors) {
      const errors = error.error.errors;
      const firstError = Object.values(errors)[0];
      if (Array.isArray(firstError) && firstError.length > 0) {
        return firstError[0] as string;
      }
      return firstError as string;
    }
    
    // HTTP status error
    if (error.status === 0) {
      return 'Network error. Please check your connection.';
    }
    
    if (error.status >= 500) {
      return 'Server error. Please try again later.';
    }
    
    if (error.status === 404) {
      return 'Resource not found.';
    }
    
    if (error.status === 403) {
      return 'You do not have permission to perform this action.';
    }
    
    if (error.status === 401) {
      return 'Authentication required. Please log in again.';
    }
    
    return error.message || 'An unexpected error occurred.';
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  return 'An unexpected error occurred.';
}

/**
 * Extract detailed error information
 */
export function extractErrorDetails(error: HttpErrorResponse | Error | unknown): ErrorDetails {
  const message = extractErrorMessage(error);
  
  if (error instanceof HttpErrorResponse) {
    return {
      message,
      code: error.error?.code || error.status?.toString(),
      field: error.error?.field,
      details: error.error
    };
  }
  
  return { message };
}

/**
 * Check if error is a validation error
 */
export function isValidationError(error: HttpErrorResponse | Error | unknown): boolean {
  if (error instanceof HttpErrorResponse) {
    return error.status === 422 && error.error?.errors !== undefined;
  }
  return false;
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: HttpErrorResponse | Error | unknown): boolean {
  if (error instanceof HttpErrorResponse) {
    return error.status === 0 || error.statusText === 'Unknown Error';
  }
  return false;
}

/**
 * Standard error handler for API calls
 */
export function handleApiError(
  error: HttpErrorResponse | Error | unknown,
  defaultMessage: string = 'An error occurred'
): string {
  const errorMessage = extractErrorMessage(error);
  console.error('API Error:', error);
  return errorMessage || defaultMessage;
}

