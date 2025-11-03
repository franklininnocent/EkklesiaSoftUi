/**
 * Pope Details Service
 * 
 * Manages global Pope image and details.
 * Pope data is global (not tenant-specific).
 * Requires manage_pope_details permission.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, catchError, finalize } from 'rxjs/operators';
import { environment } from '@environments/environment';
import { ChurchDataResponse, PopeDetails, UpdatePopeDetailsRequest } from '@core/models/church';

@Injectable({
  providedIn: 'root'
})
export class PopeDetailsService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/church-profile/pope`;

  // State management
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  private popeDetailsSubject = new BehaviorSubject<PopeDetails | null>(null);
  public popeDetails$ = this.popeDetailsSubject.asObservable();

  /**
   * Get global pope details (not tenant-specific)
   */
  getPopeDetails(): Observable<ChurchDataResponse<PopeDetails>> {
    this.setLoading(true);

    return this.http.get<ChurchDataResponse<PopeDetails>>(this.apiUrl).pipe(
      tap(response => {
        if (response.success) {
          this.popeDetailsSubject.next(response.data);
        }
      }),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Update pope details (name, title, effective_from)
   */
  updatePopeDetails(data: UpdatePopeDetailsRequest): Observable<ChurchDataResponse<PopeDetails>> {
    this.setLoading(true);

    return this.http.put<ChurchDataResponse<PopeDetails>>(this.apiUrl, data).pipe(
      tap(response => {
        if (response.success) {
          this.popeDetailsSubject.next(response.data);
        }
      }),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Upload pope image
   */
  uploadPopeImage(file: File): Observable<ChurchDataResponse<{ pope_image_path: string; pope_image_url: string }>> {
    this.setLoading(true);

    const formData = new FormData();
    formData.append('image', file);

    const headers = new HttpHeaders();
    // Don't set Content-Type - let browser set it with boundary for multipart/form-data

    return this.http.post<ChurchDataResponse<{ pope_image_path: string; pope_image_url: string }>>(
      `${this.apiUrl}/upload-image`,
      formData,
      { headers }
    ).pipe(
      tap(response => {
        if (response.success && this.popeDetailsSubject.value) {
          // Update current pope details with new image
          const currentDetails = this.popeDetailsSubject.value;
          this.popeDetailsSubject.next({
            ...currentDetails,
            pope_image_path: response.data.pope_image_path,
            pope_image_url: response.data.pope_image_url,
          });
        }
      }),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Delete pope image
   */
  deletePopeImage(): Observable<ChurchDataResponse<null>> {
    this.setLoading(true);

    return this.http.delete<ChurchDataResponse<null>>(`${this.apiUrl}/image`).pipe(
      tap(response => {
        if (response.success && this.popeDetailsSubject.value) {
          // Update current pope details to remove image
          const currentDetails = this.popeDetailsSubject.value;
          this.popeDetailsSubject.next({
            ...currentDetails,
            pope_image_path: null,
            pope_image_url: null,
          });
        }
      }),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Get current pope details value (synchronous)
   */
  get currentPopeDetails(): PopeDetails | null {
    return this.popeDetailsSubject.value;
  }

  /**
   * Clear pope details cache
   */
  clearPopeDetails(): void {
    this.popeDetailsSubject.next(null);
  }

  /**
   * Handle HTTP errors
   */
  private handleError(error: any): Observable<never> {
    console.error('Pope Details Service Error:', error);
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

