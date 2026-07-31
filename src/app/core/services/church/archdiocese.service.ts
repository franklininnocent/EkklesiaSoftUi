/**
 * Archdiocese Service
 * 
 * Handles API communication for archdioceses lookup data.
 * Read-only service with country filtering support.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, catchError, finalize } from 'rxjs/operators';
import { environment } from '@environments/environment';
import { Archdiocese, ChurchListResponse, ChurchDataResponse } from '@core/models/church';

@Injectable({
  providedIn: 'root'
})
export class ArchdioceseService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/archdioceses`;

  // State management
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  private archdiocesesSubject = new BehaviorSubject<Archdiocese[]>([]);
  public archdioceses$ = this.archdiocesesSubject.asObservable();

  /**
   * Get all active archdioceses with optional filters
   */
  getArchdioceses(filters?: {
    country?: string; // Legacy support
    country_id?: number;
    state_id?: number;
    denomination_id?: number;
    search?: string;
  }): Observable<ChurchListResponse<Archdiocese>> {
    this.setLoading(true);

    let params = new HttpParams();
    if (filters?.country) {
      params = params.set('country', filters.country);
    }
    if (filters?.country_id) {
      params = params.set('country_id', filters.country_id.toString());
    }
    if (filters?.state_id) {
      params = params.set('state_id', filters.state_id.toString());
    }
    if (filters?.denomination_id) {
      params = params.set('denomination_id', filters.denomination_id.toString());
    }
    if (filters?.search) {
      params = params.set('search', filters.search);
    }

    return this.http.get<ChurchListResponse<Archdiocese>>(this.apiUrl, { params }).pipe(
      tap(response => {
        if (response.success) {
          this.archdiocesesSubject.next(response.data);
        }
      }),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Get a single archdiocese by ID
   */
  getArchdiocese(id: number): Observable<ChurchDataResponse<Archdiocese>> {
    this.setLoading(true);

    return this.http.get<ChurchDataResponse<Archdiocese>>(`${this.apiUrl}/${id}`).pipe(
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Get list of countries with archdioceses
   */
  getCountries(): Observable<ChurchListResponse<string>> {
    this.setLoading(true);

    return this.http.get<ChurchListResponse<string>>(`${this.apiUrl}/countries`).pipe(
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Get current archdioceses value (synchronous)
   */
  get currentArchdioceses(): Archdiocese[] {
    return this.archdiocesesSubject.value;
  }

  /**
   * Handle HTTP errors
   */
  private handleError(error: any): Observable<never> {
    console.error('Archdiocese Service Error:', error);
    let errorMessage = 'An unexpected error occurred';

    if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return throwError(() => new Error(errorMessage));
  }

  /**
   * Set loading state
   */
  private setLoading(loading: boolean): void {
    this.loadingSubject.next(loading);
  }
}

