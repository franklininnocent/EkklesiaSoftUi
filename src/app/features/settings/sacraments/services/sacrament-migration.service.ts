import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '@environments/environment';
import { handleApiError } from '../utils/error-handler.util';
import {
  SacramentMigrationListResponse,
  SacramentMigrationReportResponse,
  SacramentMigrationResolution,
} from '../models/sacrament-migration.model';

@Injectable({ providedIn: 'root' })
export class SacramentMigrationService {
  private readonly baseUrl = `${environment.apiUrl}/sacraments`;

  constructor(private readonly http: HttpClient) {}

  getReport(): Observable<SacramentMigrationReportResponse> {
    return this.http.get<SacramentMigrationReportResponse>(`${this.baseUrl}/migration-resolutions/report`)
      .pipe(catchError((e: HttpErrorResponse) => throwError(() => new Error(handleApiError(e, 'Failed to load migration report')))));
  }

  list(params: {
    resolution?: string;
    confidence?: string;
    q?: string;
    page?: number;
    per_page?: number;
  } = {}): Observable<SacramentMigrationListResponse> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    });
    return this.http.get<SacramentMigrationListResponse>(`${this.baseUrl}/migration-resolutions`, { params: httpParams })
      .pipe(catchError((e: HttpErrorResponse) => throwError(() => new Error(handleApiError(e, 'Failed to load migration queue')))));
  }

  resolve(
    id: number,
    body: {
      resolution: 'member' | 'external';
      family_member_id?: string;
      external_full_name?: string;
      external_date_of_birth?: string;
    }
  ): Observable<{ success: boolean; data: SacramentMigrationResolution }> {
    return this.http.post<{ success: boolean; data: SacramentMigrationResolution }>(
      `${this.baseUrl}/migration-resolutions/${id}/resolve`,
      body
    ).pipe(catchError((e: HttpErrorResponse) => throwError(() => new Error(handleApiError(e, 'Failed to resolve')))));
  }

  backfill(dryRun = false): Observable<{ success: boolean; data: { totals: Record<string, number>; report: unknown } }> {
    return this.http.post<{ success: boolean; data: { totals: Record<string, number>; report: unknown } }>(
      `${this.baseUrl}/migration/backfill`,
      { dry_run: dryRun }
    ).pipe(catchError((e: HttpErrorResponse) => throwError(() => new Error(handleApiError(e, 'Failed to run backfill')))));
  }
}
