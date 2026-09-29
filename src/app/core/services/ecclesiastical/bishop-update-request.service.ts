import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import {
  BishopUpdateRequestItem,
  BishopUpdateRequestReview,
  BishopUpdateRequestStatus,
} from '@core/models/ecclesiastical';
import { ApiResponse } from '@core/models';

export interface BishopUpdateQueueParams {
  page?: number;
  per_page?: number;
  status?: BishopUpdateRequestStatus | string;
  tenant_id?: number;
  diocese_id?: number;
}

@Injectable({ providedIn: 'root' })
export class BishopUpdateRequestService {
  private readonly baseUrl = `${environment.apiUrl}/ecclesiastical/bishop-update-requests`;

  constructor(private http: HttpClient) {}

  list(params?: BishopUpdateQueueParams): Observable<ApiResponse<{
    data: BishopUpdateRequestItem[];
    total: number;
    current_page: number;
    last_page: number;
    per_page: number;
  }>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          httpParams = httpParams.set(key, String(value));
        }
      });
    }
    return this.http.get<ApiResponse<any>>(this.baseUrl, { params: httpParams });
  }

  get(id: string): Observable<ApiResponse<BishopUpdateRequestReview>> {
    return this.http.get<ApiResponse<BishopUpdateRequestReview>>(`${this.baseUrl}/${id}`);
  }

  markUnderReview(id: string): Observable<ApiResponse<BishopUpdateRequestItem>> {
    return this.http.post<ApiResponse<BishopUpdateRequestItem>>(`${this.baseUrl}/${id}/under-review`, {});
  }

  requestClarification(
    id: string,
    submitterFeedback: string,
    internalNotes?: string
  ): Observable<ApiResponse<BishopUpdateRequestItem>> {
    return this.http.post<ApiResponse<BishopUpdateRequestItem>>(`${this.baseUrl}/${id}/request-clarification`, {
      submitter_feedback: submitterFeedback,
      internal_reviewer_notes: internalNotes,
    });
  }

  reject(id: string, reason: string, version: number): Observable<ApiResponse<BishopUpdateRequestItem>> {
    return this.http.post<ApiResponse<BishopUpdateRequestItem>>(`${this.baseUrl}/${id}/reject`, {
      reason,
      version,
    });
  }

  approve(id: string, version: number): Observable<ApiResponse<BishopUpdateRequestItem>> {
    return this.http.post<ApiResponse<BishopUpdateRequestItem>>(`${this.baseUrl}/${id}/approve`, { version });
  }
}
