import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { ApiResponse } from '@core/models';
import {
  BishopUpdateRequestItem,
  BishopUpdateRequestStatus,
  BishopUpdateRequestType,
  DiocesanLeadership,
} from '@core/models/ecclesiastical';

export interface ChurchBishopUpdateListParams {
  page?: number;
  per_page?: number;
  status?: BishopUpdateRequestStatus | string;
}

export interface CreateChurchBishopUpdatePayload {
  request_type: BishopUpdateRequestType;
  target_bishop_id?: number;
  proposed_bishop_data: Record<string, unknown>;
  proposed_appointment_data?: Record<string, unknown>;
  supporting_information?: string;
  source_reference?: string;
  submission_notes?: string;
}

export interface UpdateChurchBishopUpdatePayload extends Partial<CreateChurchBishopUpdatePayload> {
  version: number;
}

@Injectable({ providedIn: 'root' })
export class ChurchBishopUpdateService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/tenant/bishop-updates`;

  getLeadership(): Observable<ApiResponse<DiocesanLeadership>> {
    return this.http.get<ApiResponse<DiocesanLeadership>>(`${this.baseUrl}/leadership`);
  }

  list(params?: ChurchBishopUpdateListParams): Observable<ApiResponse<{
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

  get(id: string): Observable<ApiResponse<BishopUpdateRequestItem>> {
    return this.http.get<ApiResponse<BishopUpdateRequestItem>>(`${this.baseUrl}/${id}`);
  }

  createDraft(payload: CreateChurchBishopUpdatePayload): Observable<ApiResponse<BishopUpdateRequestItem>> {
    return this.http.post<ApiResponse<BishopUpdateRequestItem>>(this.baseUrl, payload);
  }

  updateDraft(id: string, payload: UpdateChurchBishopUpdatePayload): Observable<ApiResponse<BishopUpdateRequestItem>> {
    return this.http.put<ApiResponse<BishopUpdateRequestItem>>(`${this.baseUrl}/${id}`, payload);
  }

  submit(id: string, version: number): Observable<ApiResponse<BishopUpdateRequestItem>> {
    return this.http.post<ApiResponse<BishopUpdateRequestItem>>(`${this.baseUrl}/${id}/submit`, { version });
  }

  uploadPhoto(id: string, file: File): Observable<ApiResponse<BishopUpdateRequestItem>> {
    const formData = new FormData();
    formData.append('image', file);
    return this.http.post<ApiResponse<BishopUpdateRequestItem>>(`${this.baseUrl}/${id}/photo`, formData);
  }
}
