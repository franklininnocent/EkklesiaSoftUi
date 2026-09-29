import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '@environments/environment';
import {
  Sacrament,
  SacramentType,
  SacramentCreateRequest,
  SacramentUpdateRequest,
  SacramentListParams,
  SacramentResponse,
  SacramentListResponse,
  SacramentTypeResponse,
  SacramentCertificateResponse,
  SacramentCertificateListResponse,
  SacramentCertificateViewDetailsResponse,
} from '../models/sacrament.model';
import { handleApiError } from '../utils/error-handler.util';
import {
  SacramentDashboardParams,
  SacramentDashboardResponse,
} from '../models/sacrament-dashboard.model';

export interface SacramentCreateOptions {
  idempotencyKey?: string;
}

/**
 * Sacrament Service
 * Handles all API communication for Sacrament entities
 * 
 * @class SacramentService
 */
@Injectable({
  providedIn: 'root'
})
export class SacramentService {
  private readonly baseUrl = `${environment.apiUrl}/sacraments`;
  
  // Cache for sacrament types to avoid redundant API calls
  private sacramentTypesCache$: Observable<SacramentTypeResponse> | null = null;

  constructor(private readonly http: HttpClient) {}

  // ==================== CRUD Operations ====================

  /**
   * Get paginated list of sacraments with filtering and sorting
   * 
   * @param params - Filtering, sorting, and pagination parameters
   * @returns Observable of paginated sacrament list response
   * 
   * @example
   * ```typescript
   * this.sacramentService.getSacraments({
   *   page: 1,
   *   per_page: 20,
   *   status: 'active',
   *   search: 'John Doe'
   * }).subscribe(response => {
   *   console.log(response.data);
   * });
   * ```
   */
  getSacraments(params?: SacramentListParams): Observable<SacramentListResponse> {
    let httpParams = new HttpParams();
    
    if (params) {
      Object.keys(params).forEach(key => {
        const value = params[key as keyof SacramentListParams];
        if (value !== undefined && value !== null && value !== '') {
          httpParams = httpParams.set(key, value.toString());
        }
      });
    }

    return this.http.get<SacramentListResponse>(this.baseUrl, { params: httpParams })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          const errorMessage = handleApiError(error, 'Failed to load sacraments');
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  /**
   * Get single sacrament by ID with full details
   * 
   * @param id - Sacrament ID
   * @returns Observable of sacrament response
   * 
   * @example
   * ```typescript
   * this.sacramentService.getSacrament(123).subscribe(response => {
   *   console.log(response.data);
   * });
   * ```
   */
  getSacrament(id: number): Observable<SacramentResponse> {
    return this.http.get<SacramentResponse>(`${this.baseUrl}/${id}`)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          const errorMessage = handleApiError(error, 'Failed to load sacrament details');
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  /**
   * Create new sacrament record
   * 
   * @param data - Sacrament creation data
   * @returns Observable of created sacrament response
   * 
   * @example
   * ```typescript
   * this.sacramentService.createSacrament({
   *   tenant_id: 1,
   *   sacrament_type_id: 2,
   *   recipient_name: 'John Doe',
   *   date_administered: '2025-01-01'
   * }).subscribe(response => {
   *   console.log('Created:', response.data);
   * });
   * ```
   */
  createSacrament(
    data: SacramentCreateRequest,
    options?: SacramentCreateOptions
  ): Observable<SacramentResponse> {
    let headers = new HttpHeaders();
    if (options?.idempotencyKey) {
      headers = headers.set('Idempotency-Key', options.idempotencyKey);
    }

    return this.http.post<SacramentResponse>(this.baseUrl, data, { headers })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          const errorMessage = handleApiError(error, 'Failed to create sacrament');
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  /**
   * Update existing sacrament record
   * 
   * @param id - Sacrament ID to update
   * @param data - Updated sacrament data
   * @returns Observable of updated sacrament response
   * 
   * @example
   * ```typescript
   * this.sacramentService.updateSacrament(123, {
   *   id: 123,
   *   recipient_name: 'Jane Doe'
   * }).subscribe(response => {
   *   console.log('Updated:', response.data);
   * });
   * ```
   */
  updateSacrament(id: number, data: SacramentUpdateRequest): Observable<SacramentResponse> {
    return this.http.put<SacramentResponse>(`${this.baseUrl}/${id}`, data)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          const errorMessage = handleApiError(error, 'Failed to update sacrament');
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  /**
   * Delete sacrament record (soft delete)
   * 
   * @param id - Sacrament ID to delete
   * @returns Observable of deletion response
   * 
   * @example
   * ```typescript
   * this.sacramentService.deleteSacrament(123).subscribe(response => {
   *   console.log('Deleted:', response.success);
   * });
   * ```
   */
  deleteSacrament(id: number): Observable<{success: boolean; message: string}> {
    return this.http.delete<{success: boolean; message: string}>(`${this.baseUrl}/${id}`)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          const errorMessage = handleApiError(error, 'Failed to delete sacrament');
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  // ==================== Lifecycle (ADR-07) ====================

  /**
   * Historical correction with reason + optimistic lock.
   */
  correctSacrament(
    id: number,
    payload: {
      lock_version: number;
      reason: string;
      participants?: SacramentCreateRequest['participants'];
      [key: string]: unknown;
    }
  ): Observable<SacramentResponse> {
    return this.http
      .post<SacramentResponse>(`${this.baseUrl}/${id}/correct`, payload)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          return throwError(() => error);
        })
      );
  }

  /**
   * Business void — record remains visible as voided.
   */
  voidSacrament(
    id: number,
    payload: { lock_version: number; reason: string }
  ): Observable<SacramentResponse> {
    return this.http
      .post<SacramentResponse>(`${this.baseUrl}/${id}/void`, payload)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          return throwError(() => error);
        })
      );
  }

  /**
   * Restore soft-deleted record (does not unvoid).
   */
  restoreSacrament(
    id: number,
    payload?: { lock_version?: number }
  ): Observable<SacramentResponse> {
    return this.http
      .post<SacramentResponse>(`${this.baseUrl}/${id}/restore`, payload || {})
      .pipe(
        catchError((error: HttpErrorResponse) => {
          const errorMessage = handleApiError(error, 'Failed to restore sacrament');
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  /**
   * Patch notes / registry / place metadata only.
   */
  patchMetadata(
    id: number,
    payload: {
      lock_version: number;
      notes?: string;
      book_number?: string;
      page_number?: string;
      registry_entry?: string;
      certificate_number?: string;
      place_administered?: string;
      [key: string]: unknown;
    }
  ): Observable<SacramentResponse> {
    return this.http
      .patch<SacramentResponse>(`${this.baseUrl}/${id}/metadata`, payload)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          return throwError(() => error);
        })
      );
  }

  // ==================== Certificates (Phase 8) ====================

  listCertificates(
    sacramentId: number,
    options?: { includeProjection?: boolean }
  ): Observable<SacramentCertificateListResponse> {
    const params = options?.includeProjection ? { include_projection: '1' } : undefined;
    return this.http.get<SacramentCertificateListResponse>(`${this.baseUrl}/${sacramentId}/certificates`, { params })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          return throwError(() => new Error(handleApiError(error, 'Failed to load certificates')));
        })
      );
  }

  getCertificateViewDetails(sacramentId: number): Observable<SacramentCertificateViewDetailsResponse> {
    return this.http.get<SacramentCertificateViewDetailsResponse>(
      `${this.baseUrl}/${sacramentId}/certificate-view`
    ).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => new Error(handleApiError(error, 'Failed to load certificate details')));
      })
    );
  }

  downloadLatestCertificate(sacramentId: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${sacramentId}/certificates/latest/download`, {
      responseType: 'blob',
    }).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => new Error(handleApiError(error, 'Failed to download certificate')));
      })
    );
  }

  previewCertificate(sacramentId: number): Observable<SacramentCertificateResponse> {
    return this.http.post<SacramentCertificateResponse>(
      `${this.baseUrl}/${sacramentId}/certificates/preview`,
      {}
    ).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => new Error(handleApiError(error, 'Failed to preview certificate')));
      })
    );
  }

  generateCertificate(sacramentId: number): Observable<SacramentCertificateResponse> {
    return this.http.post<SacramentCertificateResponse>(
      `${this.baseUrl}/${sacramentId}/certificates/generate`,
      {}
    ).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => new Error(handleApiError(error, 'Failed to generate certificate')));
      })
    );
  }

  reissueCertificate(certificateId: number): Observable<SacramentCertificateResponse> {
    return this.http.post<SacramentCertificateResponse>(
      `${this.baseUrl}/certificates/${certificateId}/reissue`,
      {}
    ).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => new Error(handleApiError(error, 'Failed to reissue certificate')));
      })
    );
  }

  downloadCertificate(certificateId: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/certificates/${certificateId}/download`, {
      responseType: 'blob',
    }).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => new Error(handleApiError(error, 'Failed to download certificate')));
      })
    );
  }

  printCertificate(certificateId: number): Observable<string> {
    return this.http.get(`${this.baseUrl}/certificates/${certificateId}/print`, {
      responseType: 'text',
    }).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => new Error(handleApiError(error, 'Failed to open certificate for print')));
      })
    );
  }

  verifyCertificate(token: string): Observable<{ success: boolean; data: Record<string, unknown> }> {
    return this.http.get<{ success: boolean; data: Record<string, unknown> }>(
      `${environment.apiUrl}/public/sacrament-certificates/verify/${encodeURIComponent(token)}`
    ).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => new Error(handleApiError(error, 'This certificate could not be verified')));
      })
    );
  }

  listCanonicalAnnotations(sacramentId: number): Observable<{ success: boolean; data: Sacrament['canonical_annotations'] }> {
    return this.http.get<{ success: boolean; data: Sacrament['canonical_annotations'] }>(
      `${this.baseUrl}/${sacramentId}/canonical-annotations`
    ).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => new Error(handleApiError(error, 'Failed to load register notes')));
      })
    );
  }

  createCanonicalAnnotation(
    sacramentId: number,
    payload: {
      annotation_type: string;
      effective_date?: string | null;
      granting_authority?: string | null;
      protocol_number?: string | null;
      notes?: string | null;
    }
  ): Observable<{ success: boolean; data: NonNullable<Sacrament['canonical_annotations']>[number] }> {
    return this.http.post<{ success: boolean; data: NonNullable<Sacrament['canonical_annotations']>[number] }>(
      `${this.baseUrl}/${sacramentId}/canonical-annotations`,
      payload
    ).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => new Error(handleApiError(error, 'Failed to record register note')));
      })
    );
  }

  deleteCanonicalAnnotation(sacramentId: number, annotationId: number): Observable<{ success: boolean; message?: string }> {
    return this.http.delete<{ success: boolean; message?: string }>(
      `${this.baseUrl}/${sacramentId}/canonical-annotations/${annotationId}`
    ).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => new Error(handleApiError(error, 'Failed to remove register note')));
      })
    );
  }

  // ==================== Reference Data ====================

  /**
   * Get all sacrament types (for dropdowns and selection)
   * 
   * @returns Observable of sacrament types response
   * 
   * @example
   * ```typescript
   * this.sacramentService.getSacramentTypes().subscribe(response => {
   *   this.sacramentTypes = response.data;
   * });
   * ```
   */
  getSacramentTypes(options?: { includeInactive?: boolean }): Observable<SacramentTypeResponse> {
    let params = new HttpParams();
    if (options?.includeInactive) {
      params = params.set('include_inactive', '1');
    }

    return this.http.get<SacramentTypeResponse>(`${this.baseUrl}/types`, { params })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          const errorMessage = handleApiError(error, 'Failed to load sacrament types');
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  // ==================== Bulk Operations ====================

  /**
   * Bulk update status for multiple sacraments
   * 
   * @param ids - Array of sacrament IDs to update
   * @param status - New status value (active, cancelled, conditional)
   * @returns Observable of bulk update response
   */
  bulkUpdateStatus(ids: number[], status: string): Observable<{success: boolean; message: string; data: {updated_count: number; status: string}}> {
    return this.http.post<{success: boolean; message: string; data: {updated_count: number; status: string}}>(
      `${this.baseUrl}/bulk/update-status`,
      { ids, status }
    )
      .pipe(
        catchError((error: HttpErrorResponse) => {
          const errorMessage = handleApiError(error, 'Failed to update sacraments');
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  /**
   * Bulk delete multiple sacraments
   * 
   * @param ids - Array of sacrament IDs to delete
   * @returns Observable of bulk delete response
   */
  bulkDelete(ids: number[]): Observable<{success: boolean; message: string; data: {deleted_count: number}}> {
    return this.http.post<{success: boolean; message: string; data: {deleted_count: number}}>(
      `${this.baseUrl}/bulk/delete`,
      { ids }
    )
      .pipe(
        catchError((error: HttpErrorResponse) => {
          const errorMessage = handleApiError(error, 'Failed to delete sacraments');
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  getDashboardSummary(params?: SacramentDashboardParams): Observable<SacramentDashboardResponse> {
    let httpParams = new HttpParams();

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') {
          return;
        }

        const serialized = typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
        httpParams = httpParams.set(key, serialized);
      });
    }

    return this.http
      .get<SacramentDashboardResponse>(`${this.baseUrl}/dashboard/summary`, { params: httpParams })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          const errorMessage = handleApiError(error, 'Failed to load sacrament dashboard');
          return throwError(() => new Error(errorMessage));
        })
      );
  }
}

