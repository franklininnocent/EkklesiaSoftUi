/**
 * Church Statistics Service
 * 
 * Full CRUD operations for managing church statistics
 * (membership, attendance, sacraments, finances).
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, catchError, finalize } from 'rxjs/operators';
import { environment } from '@environments/environment';
import {
  ChurchStatistic,
  ChurchListResponse,
  ChurchDataResponse,
  CreateChurchStatisticRequest,
  UpdateChurchStatisticRequest
} from '@core/models/church';

@Injectable({
  providedIn: 'root'
})
export class ChurchStatisticsService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/church-statistics`;

  // State management
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  private statisticsSubject = new BehaviorSubject<ChurchStatistic[]>([]);
  public statistics$ = this.statisticsSubject.asObservable();

  /**
   * Get all church statistics with optional filters
   */
  getStatistics(filters?: {
    year?: number;
    month?: number;
    annual?: boolean;
    monthly?: boolean;
    limit?: number;
  }): Observable<ChurchListResponse<ChurchStatistic>> {
    this.setLoading(true);

    let params = new HttpParams();
    if (filters?.year) {
      params = params.set('year', filters.year.toString());
    }
    if (filters?.month) {
      params = params.set('month', filters.month.toString());
    }
    if (filters?.annual) {
      params = params.set('annual', '1');
    }
    if (filters?.monthly) {
      params = params.set('monthly', '1');
    }
    if (filters?.limit) {
      params = params.set('limit', filters.limit.toString());
    }

    return this.http.get<ChurchListResponse<ChurchStatistic>>(this.apiUrl, { params }).pipe(
      tap(response => {
        if (response.success) {
          this.statisticsSubject.next(response.data);
        }
      }),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Get a single statistic by ID
   */
  getStatistic(id: number): Observable<ChurchDataResponse<ChurchStatistic>> {
    this.setLoading(true);

    return this.http.get<ChurchDataResponse<ChurchStatistic>>(`${this.apiUrl}/${id}`).pipe(
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Create a new statistic
   */
  createStatistic(data: CreateChurchStatisticRequest): Observable<ChurchDataResponse<ChurchStatistic>> {
    this.setLoading(true);

    return this.http.post<ChurchDataResponse<ChurchStatistic>>(this.apiUrl, data).pipe(
      tap(response => {
        if (response.success) {
          const currentStats = this.statisticsSubject.value;
          this.statisticsSubject.next([response.data, ...currentStats]);
        }
      }),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Update a statistic
   */
  updateStatistic(id: number, data: UpdateChurchStatisticRequest): Observable<ChurchDataResponse<ChurchStatistic>> {
    this.setLoading(true);

    return this.http.put<ChurchDataResponse<ChurchStatistic>>(`${this.apiUrl}/${id}`, data).pipe(
      tap(response => {
        if (response.success) {
          const currentStats = this.statisticsSubject.value;
          const updatedStats = currentStats.map(s => s.id === id ? response.data : s);
          this.statisticsSubject.next(updatedStats);
        }
      }),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Delete a statistic
   */
  deleteStatistic(id: number): Observable<ChurchDataResponse<any>> {
    this.setLoading(true);

    return this.http.delete<ChurchDataResponse<any>>(`${this.apiUrl}/${id}`).pipe(
      tap(response => {
        if (response.success) {
          const currentStats = this.statisticsSubject.value;
          this.statisticsSubject.next(currentStats.filter(s => s.id !== id));
        }
      }),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Get current statistics value (synchronous)
   */
  get currentStatistics(): ChurchStatistic[] {
    return this.statisticsSubject.value;
  }

  /**
   * Handle HTTP errors
   */
  private handleError(error: any): Observable<never> {
    console.error('Church Statistics Service Error:', error);
    let errorMessage = 'An unexpected error occurred';

    if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.error?.errors) {
      const errors = error.error.errors;
      errorMessage = Object.values(errors).flat().join(', ');
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

