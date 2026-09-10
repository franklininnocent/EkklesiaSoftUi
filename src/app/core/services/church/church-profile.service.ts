/**
 * Church Profile Service
 * 
 * Manages the extended church profile information including
 * denomination, archdiocese, bishop, and church identity fields.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, catchError, finalize } from 'rxjs/operators';
import { environment } from '@environments/environment';
import { ChurchProfile, ChurchDataResponse, UpdateChurchProfileRequest } from '@core/models/church';
import { DiocesanLeadership } from '@core/models/ecclesiastical';

@Injectable({
  providedIn: 'root'
})
export class ChurchProfileService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/church-profile`;

  // State management
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  private profileSubject = new BehaviorSubject<ChurchProfile | null>(null);
  public profile$ = this.profileSubject.asObservable();

  /**
   * Get church profile for authenticated tenant
   * Auto-creates if doesn't exist
   */
  getProfile(): Observable<ChurchDataResponse<ChurchProfile>> {
    this.setLoading(true);

    return this.http.get<ChurchDataResponse<ChurchProfile>>(this.apiUrl).pipe(
      tap(response => {
        if (response.success) {
          this.profileSubject.next(response.data);
        }
      }),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Update church profile
   */
  updateProfile(data: UpdateChurchProfileRequest): Observable<ChurchDataResponse<ChurchProfile>> {
    this.setLoading(true);

    return this.http.put<ChurchDataResponse<ChurchProfile>>(this.apiUrl, data).pipe(
      tap(response => {
        if (response.success) {
          this.profileSubject.next(response.data);
        }
      }),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  getDiocesanLeadership(): Observable<ChurchDataResponse<DiocesanLeadership>> {
    return this.http.get<ChurchDataResponse<DiocesanLeadership>>(`${this.apiUrl}/leadership/diocesan`);
  }

  /**
   * Get current profile value (synchronous)
   */
  get currentProfile(): ChurchProfile | null {
    return this.profileSubject.value;
  }

  /**
   * Upload patron image
   */
  uploadPatronImage(file: File): Observable<ChurchDataResponse<{ patron_image_path: string; patron_image_url: string }>> {
    const formData = new FormData();
    formData.append('image', file);

    return this.http.post<ChurchDataResponse<{ patron_image_path: string; patron_image_url: string }>>(
      `${this.apiUrl}/upload-patron-image`,
      formData
    ).pipe(
      tap(response => {
        if (response.success && this.profileSubject.value) {
          // Update profile with new image path
          const currentProfile = this.profileSubject.value;
          this.profileSubject.next({
            ...currentProfile,
            patron_image_path: response.data.patron_image_path,
            patron_image_url: response.data.patron_image_url,
          });
        }
      }),
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Delete patron image
   */
  deletePatronImage(): Observable<ChurchDataResponse<void>> {
    return this.http.delete<ChurchDataResponse<void>>(`${this.apiUrl}/patron-image`).pipe(
      tap(response => {
        if (response.success && this.profileSubject.value) {
          // Update profile to remove image
          const currentProfile = this.profileSubject.value;
          this.profileSubject.next({
            ...currentProfile,
            patron_image_path: undefined,
            patron_image_url: undefined,
          });
        }
      }),
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Clear profile cache
   */
  clearProfile(): void {
    this.profileSubject.next(null);
  }

  /**
   * Handle HTTP errors
   */
  private handleError(error: any): Observable<never> {
    console.error('Church Profile Service Error:', error);
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

