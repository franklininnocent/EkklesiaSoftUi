import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '@environments/environment';
import {
  ApiEnvelope,
  TenantDataExport,
  TenantDataExportListPayload,
  TenantDataExportModule,
} from './tenant-data-export.model';

@Injectable({ providedIn: 'root' })
export class TenantDataExportService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/tenant/export`;

  listModules(): Observable<TenantDataExportModule[]> {
    return this.http
      .get<ApiEnvelope<TenantDataExportModule[]>>(`${this.base}/modules`)
      .pipe(map((res) => res.data ?? []));
  }

  listExports(perPage = 20): Observable<TenantDataExport[]> {
    const params = new HttpParams().set('per_page', String(perPage));
    return this.http
      .get<ApiEnvelope<TenantDataExportListPayload | TenantDataExport[]>>(`${this.base}/bulk`, { params })
      .pipe(
        map((res) => {
          const data = res.data as TenantDataExportListPayload | TenantDataExport[];
          if (Array.isArray(data)) {
            return data;
          }
          return data?.data ?? [];
        })
      );
  }

  getExport(id: string): Observable<TenantDataExport> {
    return this.http
      .get<ApiEnvelope<TenantDataExport>>(`${this.base}/bulk/${id}`)
      .pipe(map((res) => res.data));
  }

  startExport(payload: {
    modules: string[];
    include_media?: boolean;
    format?: string;
  }): Observable<TenantDataExport> {
    return this.http
      .post<ApiEnvelope<TenantDataExport>>(`${this.base}/bulk`, payload)
      .pipe(map((res) => res.data));
  }

  cancel(id: string): Observable<TenantDataExport> {
    return this.http
      .post<ApiEnvelope<TenantDataExport>>(`${this.base}/bulk/${id}/cancel`, {})
      .pipe(map((res) => res.data));
  }

  retry(id: string): Observable<TenantDataExport> {
    return this.http
      .post<ApiEnvelope<TenantDataExport>>(`${this.base}/bulk/${id}/retry`, {})
      .pipe(map((res) => res.data));
  }

  download(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/bulk/${id}/download`, {
      responseType: 'blob',
      headers: {
        Accept: 'application/zip,application/octet-stream',
      },
    });
  }
}
