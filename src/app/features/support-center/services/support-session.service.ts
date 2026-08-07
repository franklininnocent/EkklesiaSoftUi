import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, map, tap } from 'rxjs';
import { environment } from '@environments/environment';
import {
  ApiEnvelope,
  PaginatedPayload,
  RecordSupportEventPayload,
  StartSupportSessionPayload,
  SupportAccessGrant,
  SupportAccessRequest,
  SupportEventFilters,
  SupportGrantMode,
  SupportHistoryFilters,
  SupportOpsSettings,
  SupportReasonCode,
  SupportSession,
  SupportSessionEvent,
  SupportSessionMetrics,
  SupportTenantSummary,
} from '../models/support-access.model';

const STORAGE_KEY = 'ekklesia.support_session';

@Injectable({ providedIn: 'root' })
export class SupportSessionService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/support`;

  private readonly sessionSubject = new BehaviorSubject<SupportSession | null>(this.readStored());
  readonly session$ = this.sessionSubject.asObservable();

  get currentSession(): SupportSession | null {
    return this.sessionSubject.value;
  }

  get sessionId(): string | null {
    return this.sessionSubject.value?.id ?? null;
  }

  searchTenants(q: string, perPage = 20): Observable<{ data: SupportTenantSummary[]; total: number }> {
    let params = new HttpParams().set('per_page', String(perPage));
    if (q.trim()) {
      params = params.set('q', q.trim());
    }

    return this.http.get<ApiEnvelope<any>>(`${this.base}/tenants`, { params }).pipe(
      map((res) => ({
        data: (res.data?.data ?? res.data ?? []) as SupportTenantSummary[],
        total: Number(res.data?.total ?? 0),
      }))
    );
  }

  getTenant(id: number): Observable<SupportTenantSummary> {
    return this.http
      .get<ApiEnvelope<SupportTenantSummary>>(`${this.base}/tenants/${id}`)
      .pipe(map((res) => res.data));
  }

  listSessions(perPage = 20): Observable<SupportSession[]> {
    const params = new HttpParams().set('per_page', String(perPage));
    return this.http.get<ApiEnvelope<any>>(`${this.base}/sessions`, { params }).pipe(
      map((res) => (res.data?.data ?? res.data ?? []) as SupportSession[])
    );
  }

  listActiveMonitor(perPage = 50): Observable<PaginatedPayload<SupportSession>> {
    const params = new HttpParams().set('per_page', String(perPage));
    return this.http
      .get<ApiEnvelope<PaginatedPayload<SupportSession>>>(`${this.base}/sessions/monitor`, { params })
      .pipe(map((res) => this.normalizePage(res.data)));
  }

  searchHistory(filters: SupportHistoryFilters): Observable<PaginatedPayload<SupportSession>> {
    let params = new HttpParams().set('scope', filters.scope || 'all');
    if (filters.per_page) {
      params = params.set('per_page', String(filters.per_page));
    }
    if (filters.page) {
      params = params.set('page', String(filters.page));
    }
    if (filters.status) {
      params = params.set('status', filters.status);
    }
    if (filters.mode) {
      params = params.set('mode', filters.mode);
    }
    if (filters.tenant_id) {
      params = params.set('tenant_id', String(filters.tenant_id));
    }
    if (filters.q?.trim()) {
      params = params.set('q', filters.q.trim());
    }
    if (filters.from) {
      params = params.set('from', filters.from);
    }
    if (filters.to) {
      params = params.set('to', filters.to);
    }

    return this.http
      .get<ApiEnvelope<PaginatedPayload<SupportSession>>>(`${this.base}/sessions`, { params })
      .pipe(map((res) => this.normalizePage(res.data)));
  }

  exportHistoryUrl(filters: SupportHistoryFilters): string {
    let params = new HttpParams();
    if (filters.status) {
      params = params.set('status', filters.status);
    }
    if (filters.mode) {
      params = params.set('mode', filters.mode);
    }
    if (filters.tenant_id) {
      params = params.set('tenant_id', String(filters.tenant_id));
    }
    if (filters.q?.trim()) {
      params = params.set('q', filters.q.trim());
    }
    if (filters.from) {
      params = params.set('from', filters.from);
    }
    if (filters.to) {
      params = params.set('to', filters.to);
    }

    const qs = params.toString();
    return `${this.base}/sessions/export${qs ? `?${qs}` : ''}`;
  }

  downloadHistoryCsv(filters: SupportHistoryFilters): Observable<Blob> {
    let params = new HttpParams();
    Object.entries({
      status: filters.status || undefined,
      mode: filters.mode || undefined,
      tenant_id: filters.tenant_id ? String(filters.tenant_id) : undefined,
      q: filters.q?.trim() || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
    }).forEach(([key, value]) => {
      if (value) {
        params = params.set(key, value);
      }
    });

    return this.http.get(`${this.base}/sessions/export`, {
      params,
      responseType: 'blob',
    });
  }

  getSettings(): Observable<SupportOpsSettings> {
    return this.http
      .get<ApiEnvelope<SupportOpsSettings>>(`${this.base}/settings`)
      .pipe(map((res) => res.data));
  }

  updateSettings(payload: Partial<SupportOpsSettings>): Observable<SupportOpsSettings> {
    return this.http
      .put<ApiEnvelope<SupportOpsSettings>>(`${this.base}/settings`, payload)
      .pipe(map((res) => res.data));
  }

  getActive(): Observable<SupportSession | null> {
    return this.http.get<ApiEnvelope<SupportSession | null>>(`${this.base}/sessions/active`).pipe(
      map((res) => res.data ?? null),
      tap((session) => this.setSession(session))
    );
  }

  start(payload: StartSupportSessionPayload): Observable<SupportSession> {
    return this.http.post<ApiEnvelope<SupportSession>>(`${this.base}/sessions`, payload).pipe(
      map((res) => res.data),
      tap((session) => this.setSession(session))
    );
  }

  end(sessionId: string): Observable<SupportSession> {
    return this.http.post<ApiEnvelope<SupportSession>>(`${this.base}/sessions/${sessionId}/end`, {}).pipe(
      map((res) => res.data),
      tap((session) => {
        if (this.sessionId === sessionId) {
          this.clearSession();
        }
      })
    );
  }

  forceEnd(sessionId: string): Observable<SupportSession> {
    return this.http
      .post<ApiEnvelope<SupportSession>>(`${this.base}/sessions/${sessionId}/force-end`, {})
      .pipe(
        map((res) => res.data),
        tap(() => {
          if (this.sessionId === sessionId) {
            this.clearSession();
          }
        })
      );
  }

  renew(sessionId: string, password: string): Observable<SupportSession> {
    return this.http
      .post<ApiEnvelope<SupportSession>>(`${this.base}/sessions/${sessionId}/renew`, { password })
      .pipe(
        map((res) => res.data),
        tap((session) => {
          if (this.sessionId === sessionId) {
            this.setSession(session);
          }
        })
      );
  }

  metrics(): Observable<SupportSessionMetrics> {
    return this.http
      .get<ApiEnvelope<SupportSessionMetrics>>(`${this.base}/sessions/metrics`)
      .pipe(map((res) => res.data));
  }

  recordEvent(payload: RecordSupportEventPayload): Observable<SupportSessionEvent | null> {
    const sessionId = this.sessionId;
    if (!sessionId) {
      return new Observable((subscriber) => {
        subscriber.next(null);
        subscriber.complete();
      });
    }

    return this.http
      .post<ApiEnvelope<SupportSessionEvent>>(`${this.base}/sessions/${sessionId}/events`, payload)
      .pipe(map((res) => res.data));
  }

  searchEvents(filters: SupportEventFilters): Observable<PaginatedPayload<SupportSessionEvent>> {
    let params = new HttpParams();
    Object.entries({
      support_session_id: filters.support_session_id,
      effective_tenant_id: filters.effective_tenant_id ? String(filters.effective_tenant_id) : undefined,
      event_type: filters.event_type,
      module: filters.module,
      q: filters.q?.trim() || undefined,
      from: filters.from,
      to: filters.to,
      per_page: filters.per_page ? String(filters.per_page) : '50',
    }).forEach(([key, value]) => {
      if (value) {
        params = params.set(key, value);
      }
    });

    return this.http
      .get<ApiEnvelope<PaginatedPayload<SupportSessionEvent>>>(`${this.base}/audit/events`, { params })
      .pipe(map((res) => this.normalizePage(res.data)));
  }

  downloadEventsCsv(filters: SupportEventFilters): Observable<Blob> {
    let params = new HttpParams();
    Object.entries({
      support_session_id: filters.support_session_id,
      effective_tenant_id: filters.effective_tenant_id ? String(filters.effective_tenant_id) : undefined,
      q: filters.q?.trim() || undefined,
      from: filters.from,
      to: filters.to,
    }).forEach(([key, value]) => {
      if (value) {
        params = params.set(key, value);
      }
    });

    return this.http.get(`${this.base}/audit/events/export`, {
      params,
      responseType: 'blob',
    });
  }

  listApprovals(filters: {
    status?: string;
    tenant_id?: number;
    mine?: boolean;
    per_page?: number;
  } = {}): Observable<PaginatedPayload<SupportAccessRequest>> {
    let params = new HttpParams();
    if (filters.status) {
      params = params.set('status', filters.status);
    }
    if (filters.tenant_id) {
      params = params.set('tenant_id', String(filters.tenant_id));
    }
    if (filters.mine) {
      params = params.set('mine', '1');
    }
    params = params.set('per_page', String(filters.per_page || 50));

    return this.http
      .get<ApiEnvelope<PaginatedPayload<SupportAccessRequest>>>(`${this.base}/approvals`, { params })
      .pipe(map((res) => this.normalizePage(res.data)));
  }

  requestApproval(payload: {
    tenant_id: number;
    reason_code: SupportReasonCode;
    reason_description?: string;
    ticket_ref?: string;
    mode?: 'emergency';
  }): Observable<SupportAccessRequest> {
    return this.http
      .post<ApiEnvelope<SupportAccessRequest>>(`${this.base}/approvals`, payload)
      .pipe(map((res) => res.data));
  }

  approveRequest(id: string, decision_note?: string): Observable<SupportAccessRequest> {
    return this.http
      .post<ApiEnvelope<SupportAccessRequest>>(`${this.base}/approvals/${id}/approve`, {
        decision_note: decision_note || undefined,
      })
      .pipe(map((res) => res.data));
  }

  rejectRequest(id: string, decision_note?: string): Observable<SupportAccessRequest> {
    return this.http
      .post<ApiEnvelope<SupportAccessRequest>>(`${this.base}/approvals/${id}/reject`, {
        decision_note: decision_note || undefined,
      })
      .pipe(map((res) => res.data));
  }

  cancelRequest(id: string): Observable<SupportAccessRequest> {
    return this.http
      .post<ApiEnvelope<SupportAccessRequest>>(`${this.base}/approvals/${id}/cancel`, {})
      .pipe(map((res) => res.data));
  }

  listGrants(filters: {
    status?: string;
    tenant_id?: number;
    per_page?: number;
  } = {}): Observable<PaginatedPayload<SupportAccessGrant>> {
    let params = new HttpParams();
    if (filters.status) {
      params = params.set('status', filters.status);
    }
    if (filters.tenant_id) {
      params = params.set('tenant_id', String(filters.tenant_id));
    }
    params = params.set('per_page', String(filters.per_page || 50));

    return this.http
      .get<ApiEnvelope<PaginatedPayload<SupportAccessGrant>>>(`${this.base}/grants`, { params })
      .pipe(map((res) => this.normalizePage(res.data)));
  }

  createGrant(payload: {
    tenant_id: number;
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

  revokeGrant(id: string): Observable<SupportAccessGrant> {
    return this.http
      .post<ApiEnvelope<SupportAccessGrant>>(`${this.base}/grants/${id}/revoke`, {})
      .pipe(map((res) => res.data));
  }

  clearSession(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.sessionSubject.next(null);
  }

  private normalizePage<T>(payload: any): PaginatedPayload<T> {
    if (Array.isArray(payload)) {
      return { data: payload, total: payload.length };
    }
    return {
      data: (payload?.data ?? []) as T[],
      current_page: payload?.current_page,
      last_page: payload?.last_page,
      per_page: payload?.per_page,
      total: payload?.total,
    };
  }

  private setSession(session: SupportSession | null): void {
    if (!session || session.status !== 'active') {
      this.clearSession();
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    this.sessionSubject.next(session);
  }

  private readStored(): SupportSession | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as SupportSession;
      if (!parsed?.id || parsed.status !== 'active') {
        return null;
      }
      if (parsed.expires_at && new Date(parsed.expires_at).getTime() <= Date.now()) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }
}
