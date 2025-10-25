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
   * Handle HTTP errors with proper error messages
   */
  private handleError(error: any): Observable<never> {
    let errorMessage = 'An unexpected error occurred';

    if (error.error) {
      if (error.error.message) {
        errorMessage = error.error.message;
      } else if (error.error.errors) {
        // Laravel validation errors
        const errors = error.error.errors;
        errorMessage = Object.values(errors).flat().join(', ');
      }
    } else if (error.message) {
      errorMessage = error.message;
    }

    this.setError(errorMessage);
    return throwError(() => new Error(errorMessage));
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
