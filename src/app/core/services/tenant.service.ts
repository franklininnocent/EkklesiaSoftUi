/**
 * Tenant Service
 * Handles all tenant-related API operations with proper error handling and state management
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, map, catchError, finalize } from 'rxjs/operators';
import { environment } from '@environments/environment';
import {
  Tenant,
  TenantListResponse,
  TenantResponse,
  TenantStatisticsResponse,
  LogoUploadResponse,
  TenantSuccessResponse,
  TenantErrorResponse,
  CreateTenantRequest,
  UpdateTenantRequest,
  TenantListParams,
  TenantState
} from '@core/models/tenant.model';

@Injectable({
  providedIn: 'root'
})
export class TenantService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/tenant`;

  // State management
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  private errorSubject = new BehaviorSubject<string | null>(null);
  public error$ = this.errorSubject.asObservable();

  private tenantsSubject = new BehaviorSubject<Tenant[]>([]);
  public tenants$ = this.tenantsSubject.asObservable();

  private statisticsSubject = new BehaviorSubject<TenantStatisticsResponse['data'] | null>(null);
  public statistics$ = this.statisticsSubject.asObservable();

  /**
   * Get list of all tenants with optional filters and pagination
   */
  listTenants(params?: TenantListParams): Observable<TenantListResponse> {
    this.setLoading(true);
    this.clearError();

    // Build query parameters
    const queryParams = this.buildQueryParams(params);

    return this.http.get<TenantListResponse>(`${this.apiUrl}/list`, { params: queryParams })
      .pipe(
        tap(response => {
          if (response.success && response.data) {
            this.tenantsSubject.next(response.data);
          }
        }),
        catchError(error => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  /**
   * Get a single tenant by ID
   */
  getTenant(id: number): Observable<TenantResponse> {
    this.setLoading(true);
    this.clearError();

    return this.http.get<TenantResponse>(`${this.apiUrl}/${id}`)
      .pipe(
        catchError(error => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  /**
   * Create a new tenant
   */
  createTenant(request: CreateTenantRequest): Observable<TenantResponse> {
    this.setLoading(true);
    this.clearError();

    const formData = this.buildFormData(request);

    return this.http.post<TenantResponse>(this.apiUrl, formData)
      .pipe(
        tap(response => {
          if (response.success && response.data) {
            // Add new tenant to the list
            const currentTenants = this.tenantsSubject.value;
            this.tenantsSubject.next([response.data, ...currentTenants]);
          }
        }),
        catchError(error => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  /**
   * Update an existing tenant
   */
  updateTenant(id: number, request: UpdateTenantRequest): Observable<TenantResponse> {
    this.setLoading(true);
    this.clearError();

    const formData = this.buildFormData(request);

    return this.http.post<TenantResponse>(`${this.apiUrl}/${id}?_method=PUT`, formData)
      .pipe(
        tap(response => {
          if (response.success && response.data) {
            // Update tenant in the list
            const currentTenants = this.tenantsSubject.value;
            const updatedTenants = currentTenants.map(t => 
              t.id === id ? response.data : t
            );
            this.tenantsSubject.next(updatedTenants);
          }
        }),
        catchError(error => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  /**
   * Delete a tenant
   */
  deleteTenant(id: number): Observable<TenantSuccessResponse> {
    this.setLoading(true);
    this.clearError();

    return this.http.delete<TenantSuccessResponse>(`${this.apiUrl}/${id}`)
      .pipe(
        tap(response => {
          if (response.success) {
            // Remove tenant from the list
            const currentTenants = this.tenantsSubject.value;
            this.tenantsSubject.next(currentTenants.filter(t => t.id !== id));
          }
        }),
        catchError(error => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  /**
   * Update tenant active status
   */
  updateTenantStatus(id: number, active: 0 | 1, description?: string): Observable<TenantResponse> {
    this.clearError();

    const payload: any = { active };
    if (description) {
      payload.description = description;
    }

    return this.http.patch<TenantResponse>(`${this.apiUrl}/${id}/status`, payload)
      .pipe(
        tap(response => {
          if (response.success && response.data) {
            // Update tenant status in the list
            const currentTenants = this.tenantsSubject.value;
            const updatedTenants = currentTenants.map(t => 
              t.id === id ? { ...t, active: response.data.active } : t
            );
            this.tenantsSubject.next(updatedTenants);
          }
        }),
        catchError(error => this.handleError(error))
      );
  }

  /**
   * Upload or update tenant logo
   */
  uploadLogo(id: number, file: File): Observable<LogoUploadResponse> {
    this.setLoading(true);
    this.clearError();

    const formData = new FormData();
    formData.append('logo', file);

    return this.http.post<LogoUploadResponse>(`${this.apiUrl}/${id}/logo`, formData)
      .pipe(
        tap(response => {
          if (response.success) {
            // Update tenant logo in the list
            const currentTenants = this.tenantsSubject.value;
            const updatedTenants = currentTenants.map(t => 
              t.id === id ? { ...t, logo_url: response.data.logo_url, logo_full_url: response.data.logo_full_url } : t
            );
            this.tenantsSubject.next(updatedTenants);
          }
        }),
        catchError(error => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  /**
   * Delete tenant logo
   */
  deleteLogo(id: number): Observable<TenantSuccessResponse> {
    this.setLoading(true);
    this.clearError();

    return this.http.delete<TenantSuccessResponse>(`${this.apiUrl}/${id}/logo`)
      .pipe(
        tap(response => {
          if (response.success) {
            // Remove logo from tenant in the list
            const currentTenants = this.tenantsSubject.value;
            const updatedTenants = currentTenants.map(t => 
              t.id === id ? { ...t, logo_url: null, logo_full_url: null } : t
            );
            this.tenantsSubject.next(updatedTenants);
          }
        }),
        catchError(error => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  /**
   * Get tenant statistics
   */
  getStatistics(): Observable<TenantStatisticsResponse> {
    this.setLoading(true);
    this.clearError();

    return this.http.get<TenantStatisticsResponse>(`${this.apiUrl}/statistics`)
      .pipe(
        tap(response => {
          if (response.success && response.data) {
            this.statisticsSubject.next(response.data);
          }
        }),
        catchError(error => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  /**
   * Get church profile for the current tenant user
   * Maps to tenant record but presented as "church profile"
   */
  getChurchProfile(): Observable<TenantResponse> {
    this.setLoading(true);
    this.clearError();

    return this.http.get<TenantResponse>(`${this.apiUrl}/church-profile`)
      .pipe(
        catchError(error => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  /**
   * Update church profile for the current tenant user
   * Updates the tenant record with church-specific information
   */
  updateChurchProfile(request: Partial<Tenant>): Observable<TenantResponse> {
    this.setLoading(true);
    this.clearError();

    const formData = this.buildFormData(request as any);

    return this.http.post<TenantResponse>(`${this.apiUrl}/church-profile?_method=PUT`, formData)
      .pipe(
        catchError(error => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  /**
   * Get available subscription plans
   */
  getSubscriptionPlans(): Observable<{success: boolean; data: Record<string, any>; currency?: string; duration_options?: Array<{value: number; label: string}>}> {
    this.setLoading(true);
    this.clearError();

    return this.http.get<{success: boolean; data: Record<string, any>; currency?: string; duration_options?: Array<{value: number; label: string}>}>(`${this.apiUrl}/subscription/plans`)
      .pipe(
        catchError(error => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  /**
   * Upgrade tenant subscription plan
   */
  upgradeSubscription(
    id: number,
    plan: string,
    durationMonths?: number,
    reason?: string
  ): Observable<TenantResponse> {
    this.setLoading(true);
    this.clearError();

    const payload: Record<string, unknown> = { plan };
    if (durationMonths) {
      payload['subscription_duration_months'] = durationMonths;
    }
    if (reason?.trim()) {
      payload['reason'] = reason.trim();
    }

    return this.http.post<TenantResponse>(`${this.apiUrl}/${id}/subscription/upgrade`, payload)
      .pipe(
        tap(response => {
          if (response.success && response.data) {
            const payloadData = response.data as any;
            const tenant = payloadData?.tenant ?? payloadData;
            if (tenant?.id) {
              const currentTenants = this.tenantsSubject.value;
              const updatedTenants = currentTenants.map(t =>
                t.id === id ? { ...t, ...tenant } : t
              );
              this.tenantsSubject.next(updatedTenants);
            }
          }
        }),
        catchError(error => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  /**
   * Renew tenant subscription
   */
  renewSubscription(
    id: number,
    durationMonths?: number,
    reason?: string
  ): Observable<TenantResponse> {
    this.setLoading(true);
    this.clearError();

    const payload: Record<string, unknown> = {};
    if (durationMonths) {
      payload['duration_months'] = durationMonths;
    }
    if (reason?.trim()) {
      payload['reason'] = reason.trim();
    }

    return this.http.post<TenantResponse>(`${this.apiUrl}/${id}/subscription/renew`, payload)
      .pipe(
        tap(response => {
          if (response.success && response.data) {
            const payloadData = response.data as any;
            const tenant = payloadData?.tenant ?? payloadData;
            if (tenant?.id) {
              const currentTenants = this.tenantsSubject.value;
              const updatedTenants = currentTenants.map(t =>
                t.id === id ? { ...t, ...tenant } : t
              );
              this.tenantsSubject.next(updatedTenants);
            }
          }
        }),
        catchError(error => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  /**
   * Build FormData from request object
   * Handles nested objects and file uploads
   */
  private buildFormData(request: CreateTenantRequest | UpdateTenantRequest): FormData {
    const formData = new FormData();

    console.log('Building FormData from request:', request);

    Object.keys(request).forEach(key => {
      const value = (request as any)[key];

      if (value === null || value === undefined) {
        return; // Skip null/undefined values
      }

      if (key === 'tenant_logo' && value instanceof File) {
        console.log('Appending logo file:', value.name);
        formData.append('tenant_logo', value);
      } else if (key === 'tenant_official_address' || key === 'primary_user_address' || key === 'secondary_user_address') {
        // Handle address objects - send as nested FormData keys for Laravel validation
        if (typeof value === 'object' && value !== null) {
          Object.keys(value).forEach(nestedKey => {
            const nestedValue = value[nestedKey];
            if (nestedValue !== null && nestedValue !== undefined && nestedValue !== '') {
              const formKey = `${key}[${nestedKey}]`;
              console.log(`Appending ${formKey}:`, nestedValue);
              formData.append(formKey, String(nestedValue));
            }
          });
        }
      } else if (typeof value === 'object' && !(value instanceof File)) {
        // Handle other nested objects as JSON
        console.log(`Appending ${key} as JSON:`, value);
        formData.append(key, JSON.stringify(value));
      } else if (Array.isArray(value)) {
        // Handle arrays
        console.log(`Appending ${key} as JSON array:`, value);
        formData.append(key, JSON.stringify(value));
      } else {
        // Handle primitive values
        console.log(`Appending ${key}:`, value);
        formData.append(key, String(value));
      }
    });

    // Log all FormData entries for debugging
    console.log('FormData entries:');
    formData.forEach((value, key) => {
      console.log(`  ${key}:`, value);
    });

    return formData;
  }

  /**
   * Get all subscription duration options
   */
  getDurationOptions(): Observable<{success: boolean; data: any[]; message?: string}> {
    this.setLoading(true);
    this.clearError();

    return this.http.get<{success: boolean; data: any[]; message?: string}>(`${this.apiUrl.replace('/tenant', '')}/subscription/duration-options`)
      .pipe(
        catchError(error => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  /**
   * Super Admin: platform subscription settings (grace days, etc.)
   */
  getSubscriptionSettings(): Observable<{success: boolean; data: {grace_period_days: number; expiring_warning_days: number}; message?: string}> {
    return this.http.get<{success: boolean; data: {grace_period_days: number; expiring_warning_days: number}; message?: string}>(
      `${this.apiUrl.replace('/tenant', '')}/subscription/settings`
    ).pipe(catchError(error => this.handleError(error)));
  }

  /**
   * Super Admin: update grace / expiring warning days
   */
  updateSubscriptionSettings(data: {grace_period_days: number; expiring_warning_days: number}): Observable<{success: boolean; data: {grace_period_days: number; expiring_warning_days: number}; message?: string}> {
    return this.http.put<{success: boolean; data: {grace_period_days: number; expiring_warning_days: number}; message?: string}>(
      `${this.apiUrl.replace('/tenant', '')}/subscription/settings`,
      data
    ).pipe(catchError(error => this.handleError(error)));
  }

  /**
   * Tenant: lightweight subscription access (any tenant user)
   */
  getSubscriptionAccess(): Observable<{success: boolean; data: any; message?: string}> {
    return this.http.get<{success: boolean; data: any; message?: string}>(`${this.apiUrl}/subscription-access`)
      .pipe(catchError(error => this.handleError(error)));
  }

  /**
   * Tenant: read-only My Subscription summary
   */
  getMySubscription(): Observable<{success: boolean; data: any; message?: string}> {
    return this.http.get<{success: boolean; data: any; message?: string}>(`${this.apiUrl}/my-subscription`)
      .pipe(catchError(error => this.handleError(error)));
  }

  suspendSubscription(id: number, reason?: string): Observable<TenantResponse> {
    return this.http.post<TenantResponse>(`${this.apiUrl}/${id}/subscription/suspend`, { reason })
      .pipe(catchError(error => this.handleError(error)));
  }

  reactivateSubscription(id: number, reason?: string): Observable<TenantResponse> {
    return this.http.post<TenantResponse>(`${this.apiUrl}/${id}/subscription/reactivate`, { reason })
      .pipe(catchError(error => this.handleError(error)));
  }

  /**
   * Super Admin: paginated subscription audit history for a tenant
   */
  getSubscriptionAudits(
    id: number,
    params?: { page?: number; per_page?: number; operation?: string | null }
  ): Observable<{
    success: boolean;
    data: any[];
    pagination?: {
      current_page: number;
      last_page: number;
      per_page: number;
      total: number;
      from: number | null;
      to: number | null;
    };
    meta?: { operations?: Record<string, string> };
    message?: string;
  }> {
    const queryParams: Record<string, string> = {};
    if (params?.page != null) {
      queryParams['page'] = String(params.page);
    }
    if (params?.per_page != null) {
      queryParams['per_page'] = String(params.per_page);
    }
    if (params?.operation) {
      queryParams['operation'] = params.operation;
    }

    return this.http
      .get<{
        success: boolean;
        data: any[];
        pagination?: {
          current_page: number;
          last_page: number;
          per_page: number;
          total: number;
          from: number | null;
          to: number | null;
        };
        meta?: { operations?: Record<string, string> };
        message?: string;
      }>(`${this.apiUrl}/${id}/subscription/audits`, { params: queryParams })
      .pipe(catchError(error => this.handleError(error)));
  }

  /**
   * Create a new subscription duration option
   */
  createDurationOption(data: {months: number; label: string; display_order?: number; active?: boolean}): Observable<{success: boolean; data: any; message?: string}> {
    this.setLoading(true);
    this.clearError();

    return this.http.post<{success: boolean; data: any; message?: string}>(`${this.apiUrl.replace('/tenant', '')}/subscription/duration-options`, data)
      .pipe(
        catchError(error => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  /**
   * Update a subscription duration option
   */
  updateDurationOption(id: number, data: {months?: number; label?: string; display_order?: number; active?: boolean}): Observable<{success: boolean; data: any; message?: string}> {
    this.setLoading(true);
    this.clearError();

    return this.http.put<{success: boolean; data: any; message?: string}>(`${this.apiUrl.replace('/tenant', '')}/subscription/duration-options/${id}`, data)
      .pipe(
        catchError(error => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  /**
   * Delete a subscription duration option
   */
  deleteDurationOption(id: number): Observable<{success: boolean; message?: string}> {
    this.setLoading(true);
    this.clearError();

    return this.http.delete<{success: boolean; message?: string}>(`${this.apiUrl.replace('/tenant', '')}/subscription/duration-options/${id}`)
      .pipe(
        catchError(error => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  /**
   * Get all subscription plans
   */
  getPlans(): Observable<{success: boolean; data: any[]; message?: string}> {
    this.setLoading(true);
    this.clearError();

    return this.http.get<{success: boolean; data: any[]; message?: string}>(`${this.apiUrl.replace('/tenant', '')}/subscription/plans`)
      .pipe(
        catchError(error => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  /**
   * Create a new subscription plan
   */
  createPlan(data: {key: string; name: string; description?: string; price: number; max_users: number; max_storage_mb: number; features?: string[]; display_order?: number; active?: boolean; is_default?: boolean}): Observable<{success: boolean; data: any; message?: string}> {
    this.setLoading(true);
    this.clearError();

    return this.http.post<{success: boolean; data: any; message?: string}>(`${this.apiUrl.replace('/tenant', '')}/subscription/plans`, data)
      .pipe(
        catchError(error => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  /**
   * Update a subscription plan
   */
  updatePlan(id: number, data: Partial<{key: string; name: string; description?: string; price: number; max_users: number; max_storage_mb: number; features?: string[]; display_order?: number; active?: boolean; is_default?: boolean}>): Observable<{success: boolean; data: any; message?: string}> {
    this.setLoading(true);
    this.clearError();

    return this.http.put<{success: boolean; data: any; message?: string}>(`${this.apiUrl.replace('/tenant', '')}/subscription/plans/${id}`, data)
      .pipe(
        catchError(error => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  /**
   * Delete a subscription plan
   */
  deletePlan(id: number): Observable<{success: boolean; message?: string}> {
    this.setLoading(true);
    this.clearError();

    return this.http.delete<{success: boolean; message?: string}>(`${this.apiUrl.replace('/tenant', '')}/subscription/plans/${id}`)
      .pipe(
        catchError(error => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  /**
   * Build query parameters from TenantListParams
   */
  private buildQueryParams(params?: TenantListParams): Record<string, string> {
    if (!params) {
      return {};
    }

    const queryParams: Record<string, string> = {};

    if (params.per_page !== undefined) {
      queryParams['per_page'] = String(params.per_page);
    }
    if (params.page !== undefined) {
      queryParams['page'] = String(params.page);
    }
    if (params.active !== undefined) {
      queryParams['active'] = String(params.active);
    }
    if (params.plan) {
      queryParams['plan'] = params.plan;
    }
    if (params.search) {
      queryParams['search'] = params.search;
    }
    if (params.sort_by) {
      queryParams['sort_by'] = params.sort_by;
    }
    if (params.sort_order) {
      queryParams['sort_order'] = params.sort_order;
    }

    return queryParams;
  }

  /**
   * Handle HTTP errors with proper error messages.
   * Preserves structured shape from errorInterceptor ({ message, status, errors }).
   */
  private handleError(error: any): Observable<never> {
    let errorMessage = 'An unexpected error occurred';

    if (error?.error?.message) {
      errorMessage = error.error.message;
    } else if (error?.error?.errors) {
      const errors = error.error.errors;
      errorMessage = Object.values(errors).flat().join(', ');
    } else if (error?.errors) {
      errorMessage = Object.values(error.errors).flat().join(', ');
    } else if (error?.message) {
      errorMessage = error.message;
    }

    this.setError(errorMessage);
    return throwError(() => ({
      message: errorMessage,
      status: error?.status,
      errors: error?.errors ?? error?.error?.errors,
      error: error?.error ?? { message: errorMessage },
    }));
  }

  /**
   * Set loading state
   */
  private setLoading(loading: boolean): void {
    this.loadingSubject.next(loading);
  }

  /**
   * Set error message
   */
  private setError(error: string | null): void {
    this.errorSubject.next(error);
  }

  /**
   * Clear error message
   */
  clearError(): void {
    this.errorSubject.next(null);
  }

  /**
   * Get current tenants value (synchronous)
   */
  get currentTenants(): Tenant[] {
    return this.tenantsSubject.value;
  }

  /**
   * Get loading state value (synchronous)
   */
  get isLoading(): boolean {
    return this.loadingSubject.value;
  }

  /**
   * Get current error value (synchronous)
   */
  get currentError(): string | null {
    return this.errorSubject.value;
  }
}
