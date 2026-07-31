/**
 * Church Leadership Service
 * 
 * Full CRUD operations for managing church leaders
 * (pastors, associate pastors, ministry leaders).
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { tap, catchError, finalize } from 'rxjs/operators';
import { environment } from '@environments/environment';
import {
  ChurchLeadership,
  ChurchListResponse,
  ChurchDataResponse,
  CreateChurchLeadershipRequest,
  UpdateChurchLeadershipRequest
} from '@core/models/church';

@Injectable({
  providedIn: 'root'
})
export class ChurchLeadershipService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/church-leadership`;

  // State management
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  private leadersSubject = new BehaviorSubject<ChurchLeadership[]>([]);
  public leaders$ = this.leadersSubject.asObservable();

  /**
   * Get all church leaders with optional filters
   */
  getLeaders(filters?: {
    active?: number;
    role?: string;
    current?: boolean;
  }): Observable<ChurchListResponse<ChurchLeadership>> {
    this.setLoading(true);

    let params = new HttpParams();
    if (filters?.active !== undefined) {
      params = params.set('active', filters.active.toString());
    }
    if (filters?.role) {
      params = params.set('role', filters.role);
    }
    if (filters?.current) {
      params = params.set('current', '1');
    }

    return this.http.get<ChurchListResponse<ChurchLeadership>>(this.apiUrl, { params }).pipe(
      tap(response => {
        if (response.success) {
          this.leadersSubject.next(response.data);
        }
      }),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Get a single leader by ID
   */
  getLeader(id: number): Observable<ChurchDataResponse<ChurchLeadership>> {
    this.setLoading(true);

    return this.http.get<ChurchDataResponse<ChurchLeadership>>(`${this.apiUrl}/${id}`).pipe(
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Create a new leader
   */
  createLeader(data: CreateChurchLeadershipRequest): Observable<ChurchDataResponse<ChurchLeadership>> {
    this.setLoading(true);

    return this.http.post<ChurchDataResponse<ChurchLeadership>>(this.apiUrl, data).pipe(
      tap(response => {
        if (response.success) {
          const currentLeaders = this.leadersSubject.value;
          this.leadersSubject.next([response.data, ...currentLeaders]);
        }
      }),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Update a leader
   */
  updateLeader(id: number, data: UpdateChurchLeadershipRequest): Observable<ChurchDataResponse<ChurchLeadership>> {
    this.setLoading(true);

    return this.http.put<ChurchDataResponse<ChurchLeadership>>(`${this.apiUrl}/${id}`, data).pipe(
      tap(response => {
        if (response.success) {
          const currentLeaders = this.leadersSubject.value;
          const updatedLeaders = currentLeaders.map(l => l.id === id ? response.data : l);
          this.leadersSubject.next(updatedLeaders);
        }
      }),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Upload or replace a leader profile photo
   */
  uploadLeaderPhoto(id: number, file: File): Observable<ChurchDataResponse<ChurchLeadership>> {
    this.setLoading(true);
    const formData = new FormData();
    formData.append('image', file);

    return this.http.post<ChurchDataResponse<ChurchLeadership>>(`${this.apiUrl}/${id}/upload-photo`, formData).pipe(
      tap((response) => {
        if (response.success) {
          const currentLeaders = this.leadersSubject.value;
          const updatedLeaders = currentLeaders.map((leader) => leader.id === id ? response.data : leader);
          this.leadersSubject.next(updatedLeaders);
        }
      }),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Resolve a stored leader photo path to a browser-loadable URL.
   */
  resolveLeaderPhotoUrl(photoUrl?: string | null): string | null {
    if (!photoUrl) {
      return null;
    }

    if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://') || photoUrl.startsWith('data:')) {
      return photoUrl;
    }

    const baseUrl = environment.apiUrl.replace('/api', '');
    return baseUrl.endsWith('/')
      ? `${baseUrl}storage/${photoUrl}`
      : `${baseUrl}/storage/${photoUrl}`;
  }

  /**
   * Delete a leader
   */
  deleteLeader(id: number): Observable<ChurchDataResponse<any>> {
    this.setLoading(true);

    return this.http.delete<ChurchDataResponse<any>>(`${this.apiUrl}/${id}`).pipe(
      tap(response => {
        if (response.success) {
          const currentLeaders = this.leadersSubject.value;
          this.leadersSubject.next(currentLeaders.filter(l => l.id !== id));
        }
      }),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Get current leaders value (synchronous)
   */
  get currentLeaders(): ChurchLeadership[] {
    return this.leadersSubject.value;
  }

  /**
   * Handle HTTP errors
   */
  private handleError(error: any): Observable<never> {
    console.error('Church Leadership Service Error:', error);
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

