import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';

export type PasswordRecoveryViewState = 'LOGIN' | 'FORGOT_EMAIL' | 'FORGOT_SUCCESS';

export interface PasswordRecoveryRequestItem {
  id: string;
  status: string;
  requester_name?: string | null;
  requester_email: string;
  requester_role?: string | null;
  requester_classification: string;
  tenant_name?: string | null;
  tenant_id?: number | null;
  requested_at?: string | null;
  expires_at?: string | null;
  can_approve: boolean;
  can_reject: boolean;
  can_retry_delivery: boolean;
  request_ip?: string | null;
  user_agent?: string | null;
  rejection_reason?: string | null;
  failure_reason?: string | null;
  processed_at?: string | null;
  completed_at?: string | null;
  user_active?: boolean | null;
}

@Injectable({
  providedIn: 'root',
})
export class PasswordRecoveryService {
  private readonly http = inject(HttpClient);
  private readonly publicRequestUrl = `${environment.apiUrl}/auth/password/recovery/request`;
  private readonly adminPrefix = `${environment.apiUrl}/auth/password-recovery-requests`;

  requestRecovery(email: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(this.publicRequestUrl, { email });
  }

  listRequests(params: Record<string, string | number | undefined> = {}): Observable<{
    success: boolean;
    message: string;
    data: PasswordRecoveryRequestItem[];
    meta: { current_page: number; last_page: number; per_page: number; total: number };
  }> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.set(key, String(value));
      }
    });
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.http.get<{
      success: boolean;
      message: string;
      data: PasswordRecoveryRequestItem[];
      meta: { current_page: number; last_page: number; per_page: number; total: number };
    }>(`${this.adminPrefix}${suffix}`);
  }

  getRequest(id: string): Observable<{ success: boolean; message: string; data: PasswordRecoveryRequestItem }> {
    return this.http.get<{ success: boolean; message: string; data: PasswordRecoveryRequestItem }>(
      `${this.adminPrefix}/${id}`
    );
  }

  approveRequest(id: string): Observable<{ success: boolean; message: string; data: { status: string } }> {
    return this.http.post<{ success: boolean; message: string; data: { status: string } }>(
      `${this.adminPrefix}/${id}/approve`,
      {}
    );
  }

  rejectRequest(id: string, reason?: string): Observable<{ success: boolean; message: string; data: { status: string } }> {
    return this.http.post<{ success: boolean; message: string; data: { status: string } }>(
      `${this.adminPrefix}/${id}/reject`,
      { reason }
    );
  }

  retryDelivery(id: string): Observable<{ success: boolean; message: string; data: { status: string } }> {
    return this.http.post<{ success: boolean; message: string; data: { status: string } }>(
      `${this.adminPrefix}/${id}/retry-delivery`,
      {}
    );
  }
}
