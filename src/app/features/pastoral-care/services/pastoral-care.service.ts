import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '@environments/environment';
import {
  CreatePastoralCarePayload,
  PastoralCareDashboard,
  PastoralCareRequest,
  PastoralCareStaff,
} from '../models/pastoral-care.model';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
  total?: number;
}

@Injectable({ providedIn: 'root' })
export class PastoralCareService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/tenant/pastoral`;

  list(filters: { family_id?: string; status?: string } = {}): Observable<PastoralCareRequest[]> {
    let params = new HttpParams();
    if (filters.family_id) {
      params = params.set('family_id', filters.family_id);
    }
    if (filters.status) {
      params = params.set('status', filters.status);
    }
    return this.http
      .get<ApiEnvelope<PastoralCareRequest[]>>(`${this.base}/requests`, { params })
      .pipe(map((res) => res.data ?? []));
  }

  create(payload: CreatePastoralCarePayload): Observable<PastoralCareRequest> {
    return this.http
      .post<ApiEnvelope<PastoralCareRequest>>(`${this.base}/requests`, payload)
      .pipe(map((res) => res.data));
  }

  assign(id: string, assignedToUserId: number): Observable<PastoralCareRequest> {
    return this.http
      .post<ApiEnvelope<PastoralCareRequest>>(`${this.base}/requests/${id}/assign`, {
        assigned_to_user_id: assignedToUserId,
      })
      .pipe(map((res) => res.data));
  }

  complete(id: string): Observable<PastoralCareRequest> {
    return this.http
      .post<ApiEnvelope<PastoralCareRequest>>(`${this.base}/requests/${id}/complete`, {})
      .pipe(map((res) => res.data));
  }

  staff(): Observable<PastoralCareStaff[]> {
    return this.http
      .get<ApiEnvelope<PastoralCareStaff[]>>(`${this.base}/staff`)
      .pipe(map((res) => res.data ?? []));
  }

  dashboard(): Observable<PastoralCareDashboard> {
    return this.http
      .get<ApiEnvelope<PastoralCareDashboard>>(`${this.base}/dashboard`)
      .pipe(map((res) => res.data));
  }
}
