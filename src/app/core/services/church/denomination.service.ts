/**
 * Denomination Service
 * 
 * Handles API communication for church denominations lookup data.
 * Read-only service for dropdown lists and selection.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, catchError, finalize } from 'rxjs/operators';
import { environment } from '@environments/environment';
import { Denomination, ChurchListResponse, ChurchDataResponse } from '@core/models/church';

@Injectable({
  providedIn: 'root'
})
export class DenominationService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/denominations`;

  // State management
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  private denominationsSubject = new BehaviorSubject<Denomination[]>([]);
  public denominations$ = this.denominationsSubject.asObservable();

  /**
   * Get all active denominations
   */
  getDenominations(search?: string): Observable<ChurchListResponse<Denomination>> {
    this.setLoading(true);

    let params = new HttpParams();
    if (search) {
      params = params.set('search', search);
    }

    return this.http.get<ChurchListResponse<Denomination>>(this.apiUrl, { params }).pipe(
      tap(response => {
        if (response.success) {
          this.denominationsSubject.next(response.data);
        }
      }),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Get a single denomination by ID
   */
  getDenomination(id: number): Observable<ChurchDataResponse<Denomination>> {
    this.setLoading(true);

    return this.http.get<ChurchDataResponse<Denomination>>(`${this.apiUrl}/${id}`).pipe(
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Get current denominations value (synchronous)
   */
  get currentDenominations(): Denomination[] {
    return this.denominationsSubject.value;
  }

  /**
   * Handle HTTP errors
   */
  private handleError(error: any): Observable<never> {
    console.error('Denomination Service Error:', error);
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

