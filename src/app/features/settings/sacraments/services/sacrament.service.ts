import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
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
  SacramentTypeResponse
} from '../models/sacrament.model';
import { handleApiError } from '../utils/error-handler.util';

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
  createSacrament(data: SacramentCreateRequest): Observable<SacramentResponse> {
    return this.http.post<SacramentResponse>(this.baseUrl, data)
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
  getSacramentTypes(): Observable<SacramentTypeResponse> {
    return this.http.get<SacramentTypeResponse>(`${this.baseUrl}/types`)
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
}

