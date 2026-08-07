import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '@environments/environment';
import {
  ApiEnvelope,
  PaginatedPayload,
  SupportAccessGrant,
  SupportGrantMode,
} from '../../support-center/models/support-access.model';

@Injectable({ providedIn: 'root' })
export class ParishSupportGrantService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/tenant/support-access`;

  list(filters: { status?: string; per_page?: number } = {}): Observable<SupportAccessGrant[]> {
    let params = new HttpParams().set('per_page', String(filters.per_page || 50));
    if (filters.status) {
      params = params.set('status', filters.status);
    }

    return this.http
      .get<ApiEnvelope<PaginatedPayload<SupportAccessGrant> | SupportAccessGrant[]>>(`${this.base}/grants`, {
        params,
      })
      .pipe(
        map((res) => {
          const data = res.data as any;
          if (Array.isArray(data)) {
            return data as SupportAccessGrant[];
          }
          return (data?.data ?? []) as SupportAccessGrant[];
        })
      );
  }

  create(payload: {
    allowed_mode: SupportGrantMode;
    starts_at: string;
    ends_at: string;
    note?: string;
    max_sessions?: number | null;
  }): Observable<SupportAccessGrant> {
    return this.http
      .post<ApiEnvelope<SupportAccessGrant>>(`${this.base}/grants`, payload)
      .pipe(map((res) => res.data));
  }

  revoke(id: string): Observable<SupportAccessGrant> {
    return this.http
      .post<ApiEnvelope<SupportAccessGrant>>(`${this.base}/grants/${id}/revoke`, {})
      .pipe(map((res) => res.data));
  }
}
