import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import {
  AssignLeadershipPayload,
  CurrentLeadershipResponse,
  HandoverLeadershipPayload,
  LeadershipHistoryFilters,
  LeadershipRoleOption,
  LeadershipAssignment,
  PaginatedLeadershipHistory,
  TerminateLeadershipPayload,
  UpdateLeadershipAssignmentPayload,
} from '@core/models/church/leadership-governance.model';

interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class ChurchLeadershipGovernanceService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/church-profile/leadership`;

  getCurrent(): Observable<ApiEnvelope<CurrentLeadershipResponse>> {
    return this.http.get<ApiEnvelope<CurrentLeadershipResponse>>(`${this.baseUrl}/current`);
  }

  getHistory(filters: LeadershipHistoryFilters = {}): Observable<PaginatedLeadershipHistory> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http.get<PaginatedLeadershipHistory>(`${this.baseUrl}/history`, { params });
  }

  listRoles(category?: string): Observable<ApiEnvelope<LeadershipRoleOption[]>> {
    let params = new HttpParams();
    if (category) {
      params = params.set('category', category);
    }
    return this.http.get<ApiEnvelope<LeadershipRoleOption[]>>(`${this.baseUrl}/roles`, { params });
  }

  assign(payload: AssignLeadershipPayload): Observable<ApiEnvelope<LeadershipAssignment>> {
    return this.http.post<ApiEnvelope<LeadershipAssignment>>(`${this.baseUrl}/assign`, payload);
  }

  handover(payload: HandoverLeadershipPayload): Observable<ApiEnvelope<{ outgoing: LeadershipAssignment; incoming: LeadershipAssignment }>> {
    return this.http.post<ApiEnvelope<{ outgoing: LeadershipAssignment; incoming: LeadershipAssignment }>>(
      `${this.baseUrl}/handover`,
      payload,
    );
  }

  terminate(assignmentId: string, payload: TerminateLeadershipPayload): Observable<ApiEnvelope<LeadershipAssignment>> {
    return this.http.put<ApiEnvelope<LeadershipAssignment>>(
      `${this.baseUrl}/assignments/${assignmentId}/terminate`,
      payload,
    );
  }

  updateAssignment(
    assignmentId: string,
    payload: UpdateLeadershipAssignmentPayload,
  ): Observable<ApiEnvelope<LeadershipAssignment>> {
    return this.http.put<ApiEnvelope<LeadershipAssignment>>(
      `${this.baseUrl}/assignments/${assignmentId}`,
      payload,
    );
  }

  uploadAssignmentPhoto(assignmentId: string, file: File): Observable<ApiEnvelope<LeadershipAssignment>> {
    const formData = new FormData();
    formData.append('image', file);
    return this.http.post<ApiEnvelope<LeadershipAssignment>>(
      `${this.baseUrl}/assignments/${assignmentId}/photo`,
      formData,
    );
  }
}
