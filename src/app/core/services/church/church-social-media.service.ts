/**
 * Church Social Media Service
 * 
 * Full CRUD operations for managing church social media accounts
 * (Facebook, Twitter, Instagram, YouTube, etc.).
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, catchError, finalize } from 'rxjs/operators';
import { environment } from '@environments/environment';
import {
  ChurchSocialMedia,
  ChurchListResponse,
  ChurchDataResponse,
  CreateChurchSocialMediaRequest,
  UpdateChurchSocialMediaRequest
} from '@core/models/church';

@Injectable({
  providedIn: 'root'
})
export class ChurchSocialMediaService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/church-social-media`;

  // State management
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  private socialMediaSubject = new BehaviorSubject<ChurchSocialMedia[]>([]);
  public socialMedia$ = this.socialMediaSubject.asObservable();

  /**
   * Get all social media accounts with optional filters
   */
  getSocialMedia(filters?: {
    platform?: string;
    active?: number;
    primary?: boolean;
  }): Observable<ChurchListResponse<ChurchSocialMedia>> {
    this.setLoading(true);

    let params = new HttpParams();
    if (filters?.platform) {
      params = params.set('platform', filters.platform);
    }
    if (filters?.active !== undefined) {
      params = params.set('active', filters.active.toString());
    }
    if (filters?.primary) {
      params = params.set('primary', '1');
    }

    return this.http.get<ChurchListResponse<ChurchSocialMedia>>(this.apiUrl, { params }).pipe(
      tap(response => {
        if (response.success) {
          this.socialMediaSubject.next(response.data);
        }
      }),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Get a single social media account by ID
   */
  getSocialMediaAccount(id: number): Observable<ChurchDataResponse<ChurchSocialMedia>> {
    this.setLoading(true);

    return this.http.get<ChurchDataResponse<ChurchSocialMedia>>(`${this.apiUrl}/${id}`).pipe(
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Create a new social media account
   */
  createSocialMedia(data: CreateChurchSocialMediaRequest): Observable<ChurchDataResponse<ChurchSocialMedia>> {
    this.setLoading(true);

    return this.http.post<ChurchDataResponse<ChurchSocialMedia>>(this.apiUrl, data).pipe(
      tap(response => {
        if (response.success) {
          const currentAccounts = this.socialMediaSubject.value;
          this.socialMediaSubject.next([response.data, ...currentAccounts]);
        }
      }),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Update a social media account
   */
  updateSocialMedia(id: number, data: UpdateChurchSocialMediaRequest): Observable<ChurchDataResponse<ChurchSocialMedia>> {
    this.setLoading(true);

    return this.http.put<ChurchDataResponse<ChurchSocialMedia>>(`${this.apiUrl}/${id}`, data).pipe(
      tap(response => {
        if (response.success) {
          const currentAccounts = this.socialMediaSubject.value;
          const updatedAccounts = currentAccounts.map(a => a.id === id ? response.data : a);
          this.socialMediaSubject.next(updatedAccounts);
        }
      }),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Delete a social media account
   */
  deleteSocialMedia(id: number): Observable<ChurchDataResponse<any>> {
    this.setLoading(true);

    return this.http.delete<ChurchDataResponse<any>>(`${this.apiUrl}/${id}`).pipe(
      tap(response => {
        if (response.success) {
          const currentAccounts = this.socialMediaSubject.value;
          this.socialMediaSubject.next(currentAccounts.filter(a => a.id !== id));
        }
      }),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Get current social media accounts value (synchronous)
   */
  get currentSocialMedia(): ChurchSocialMedia[] {
    return this.socialMediaSubject.value;
  }

  /**
   * Get platform icon class
   */
  getPlatformIcon(platform: string): string {
    const icons: { [key: string]: string } = {
      'facebook': '📘',
      'twitter': '🐦',
      'instagram': '📷',
      'youtube': '📺',
      'linkedin': '💼',
      'tiktok': '🎵',
      'whatsapp': '💬'
    };
    return icons[platform] || '🔗';
  }

  /**
   * Get platform color
   */
  getPlatformColor(platform: string): string {
    const colors: { [key: string]: string } = {
      'facebook': '#1877f2',
      'twitter': '#1da1f2',
      'instagram': '#e4405f',
      'youtube': '#ff0000',
      'linkedin': '#0077b5',
      'tiktok': '#000000',
      'whatsapp': '#25d366'
    };
    return colors[platform] || '#6c757d';
  }

  /**
   * Handle HTTP errors
   */
  private handleError(error: any): Observable<never> {
    console.error('Church Social Media Service Error:', error);
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

