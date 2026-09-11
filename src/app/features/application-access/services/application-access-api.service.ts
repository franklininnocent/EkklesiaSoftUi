import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '@environments/environment';
import {
  ApiEnvelope,
  ApplicationAccessDashboard,
  ApplicationAccessEvent,
  ApplicationAccessListParams,
  ApplicationAccessSession,
  ApplicationIpBlockRule,
  ApplicationSecurityEvent,
  ApplicationSecuritySignal,
  CursorResponse,
  PaginatedResponse,
  StoreApplicationIpBlockPayload,
} from '../models/application-access.model';

@Injectable({ providedIn: 'root' })
export class ApplicationAccessApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/application-access`;

  getDashboard(): Observable<ApplicationAccessDashboard> {
    return this.http
      .get<ApiEnvelope<ApplicationAccessDashboard>>(`${this.base}/dashboard`)
      .pipe(map((response) => response.data));
  }

  listSessions(params: ApplicationAccessListParams = {}): Observable<PaginatedResponse<ApplicationAccessSession>> {
    return this.http
      .get<ApiEnvelope<ApplicationAccessSession[]> & { meta: PaginatedResponse<ApplicationAccessSession>['meta'] }>(
        `${this.base}/sessions`,
        { params: this.toParams(params) }
      )
      .pipe(
        map((response) => ({
          data: response.data ?? [],
          meta: response.meta,
        }))
      );
  }

  getSession(id: string): Observable<ApplicationAccessSession> {
    return this.http
      .get<ApiEnvelope<ApplicationAccessSession>>(`${this.base}/sessions/${id}`)
      .pipe(map((response) => response.data));
  }

  getSessionTimeline(
    id: string,
    params: { per_page?: number; cursor?: string } = {}
  ): Observable<CursorResponse<ApplicationAccessEvent>> {
    return this.http
      .get<ApiEnvelope<ApplicationAccessEvent[]> & { meta: CursorResponse<ApplicationAccessEvent>['meta'] }>(
        `${this.base}/sessions/${id}/timeline`,
        { params: this.toParams(params) }
      )
      .pipe(
        map((response) => ({
          data: response.data ?? [],
          meta: response.meta,
        }))
      );
  }

  listEvents(params: ApplicationAccessListParams = {}): Observable<PaginatedResponse<ApplicationAccessEvent>> {
    return this.http
      .get<ApiEnvelope<ApplicationAccessEvent[]> & { meta: PaginatedResponse<ApplicationAccessEvent>['meta'] }>(
        `${this.base}/events`,
        { params: this.toParams(params) }
      )
      .pipe(
        map((response) => ({
          data: response.data ?? [],
          meta: response.meta,
        }))
      );
  }

  listSecurityEvents(
    params: ApplicationAccessListParams = {}
  ): Observable<PaginatedResponse<ApplicationSecurityEvent>> {
    return this.http
      .get<ApiEnvelope<ApplicationSecurityEvent[]> & { meta: PaginatedResponse<ApplicationSecurityEvent>['meta'] }>(
        `${this.base}/security-events`,
        { params: this.toParams(params) }
      )
      .pipe(
        map((response) => ({
          data: response.data ?? [],
          meta: response.meta,
        }))
      );
  }

  listSignals(params: ApplicationAccessListParams = {}): Observable<PaginatedResponse<ApplicationSecuritySignal>> {
    return this.http
      .get<ApiEnvelope<ApplicationSecuritySignal[]> & { meta: PaginatedResponse<ApplicationSecuritySignal>['meta'] }>(
        `${this.base}/signals`,
        { params: this.toParams(params) }
      )
      .pipe(
        map((response) => ({
          data: response.data ?? [],
          meta: response.meta,
        }))
      );
  }

  revokeSession(id: string): Observable<{ session: ApplicationAccessSession; revoked_self: boolean; message: string }> {
    return this.http
      .post<ApiEnvelope<ApplicationAccessSession> & { revoked_self: boolean; message: string }>(
        `${this.base}/sessions/${id}/revoke`,
        {}
      )
      .pipe(
        map((response) => ({
          session: response.data,
          revoked_self: response.revoked_self,
          message: response.message ?? 'Session revoked.',
        }))
      );
  }

  createIpBlock(payload: StoreApplicationIpBlockPayload): Observable<ApplicationIpBlockRule> {
    return this.http
      .post<ApiEnvelope<ApplicationIpBlockRule>>(`${this.base}/ip-blocks`, payload)
      .pipe(map((response) => response.data));
  }

  revokeIpBlock(id: string): Observable<ApplicationIpBlockRule> {
    return this.http
      .post<ApiEnvelope<ApplicationIpBlockRule>>(`${this.base}/ip-blocks/${id}/revoke`, {})
      .pipe(map((response) => response.data));
  }

  exportSessions(params: ApplicationAccessListParams = {}): Observable<Blob> {
    return this.http.get(`${this.base}/export/sessions`, {
      params: this.toParams(params),
      responseType: 'blob',
    });
  }

  private toParams(params: object): HttpParams {
    let httpParams = new HttpParams();

    Object.entries(params as Record<string, string | number | undefined | null>).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    });

    return httpParams;
  }
}
