import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '@environments/environment';
import {
  OpsSupportTicketDetail,
  OpsSupportTicketListResponse,
  OpsSupportTicketMetrics,
  OpsSupportTicketRow,
} from '../models/support-ops-ticket.model';

@Injectable({ providedIn: 'root' })
export class SupportOpsTicketService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/support/tickets`;

  list(perPage = 50): Observable<OpsSupportTicketRow[]> {
    const params = new HttpParams().set('per_page', String(perPage));
    return this.http.get<OpsSupportTicketListResponse>(this.base, { params }).pipe(
      map((response) => this.extractRows(response.data))
    );
  }

  getDashboard(): Observable<OpsSupportTicketMetrics> {
    return this.http
      .get<{ success: boolean; data: OpsSupportTicketMetrics }>(`${this.base}/dashboard`)
      .pipe(map((response) => response.data));
  }

  getTicket(idOrNumber: string): Observable<OpsSupportTicketDetail> {
    return this.http
      .get<{ success: boolean; data: OpsSupportTicketDetail }>(
        `${this.base}/${encodeURIComponent(idOrNumber)}`
      )
      .pipe(map((response) => response.data));
  }

  addComment(ticketId: string, body: string): Observable<unknown> {
    return this.http.post(`${this.base}/${encodeURIComponent(ticketId)}/comments`, { body });
  }

  addInternalNote(ticketId: string, body: string): Observable<unknown> {
    return this.http.post(`${this.base}/${encodeURIComponent(ticketId)}/internal-notes`, { body });
  }

  downloadAttachment(ticketId: string, attachmentId: number): Observable<Blob> {
    return this.http.get(`${this.base}/${encodeURIComponent(ticketId)}/attachments/${attachmentId}/download`, {
      responseType: 'blob',
    });
  }

  assignTicket(ticketId: string, payload?: { assigned_agent_id?: number; queue_id?: number; reason?: string }): Observable<OpsSupportTicketDetail> {
    return this.http
      .post<{ success: boolean; data: OpsSupportTicketDetail }>(
        `${this.base}/${encodeURIComponent(ticketId)}/assign`,
        payload ?? {}
      )
      .pipe(map((response) => response.data));
  }

  setAwaitingYou(ticketId: string, reason?: string): Observable<OpsSupportTicketDetail> {
    return this.postStatus(ticketId, 'status/awaiting-you', reason);
  }

  setAwaitingEkklesia(ticketId: string, reason?: string): Observable<OpsSupportTicketDetail> {
    return this.postStatus(ticketId, 'status/awaiting-ekklesia', reason);
  }

  setInProgress(ticketId: string, reason?: string): Observable<OpsSupportTicketDetail> {
    return this.postStatus(ticketId, 'status/in-progress', reason);
  }

  resolveTicket(
    ticketId: string,
    payload: {
      resolution_summary: string;
      resolution_category?: string;
      root_cause?: string;
      workaround?: string;
      permanent_fix?: string;
    }
  ): Observable<OpsSupportTicketDetail> {
    return this.http
      .post<{ success: boolean; data: OpsSupportTicketDetail }>(
        `${this.base}/${encodeURIComponent(ticketId)}/resolve`,
        payload
      )
      .pipe(map((response) => response.data));
  }

  closeTicket(ticketId: string, reason?: string): Observable<OpsSupportTicketDetail> {
    const payload = reason?.trim() ? { reason: reason.trim() } : {};
    return this.http
      .post<{ success: boolean; data: OpsSupportTicketDetail }>(
        `${this.base}/${encodeURIComponent(ticketId)}/close`,
        payload
      )
      .pipe(map((response) => response.data));
  }

  reopenTicket(ticketId: string, reason: string): Observable<OpsSupportTicketDetail> {
    return this.http
      .post<{ success: boolean; data: OpsSupportTicketDetail }>(
        `${this.base}/${encodeURIComponent(ticketId)}/reopen`,
        { reason }
      )
      .pipe(map((response) => response.data));
  }

  changePriority(ticketId: string, priority: string): Observable<OpsSupportTicketDetail> {
    return this.http
      .put<{ success: boolean; data: OpsSupportTicketDetail }>(
        `${this.base}/${encodeURIComponent(ticketId)}/priority`,
        { priority }
      )
      .pipe(map((response) => response.data));
  }

  private postStatus(ticketId: string, path: string, reason?: string): Observable<OpsSupportTicketDetail> {
    const payload = reason?.trim() ? { reason: reason.trim() } : {};
    return this.http
      .post<{ success: boolean; data: OpsSupportTicketDetail }>(
        `${this.base}/${encodeURIComponent(ticketId)}/${path}`,
        payload
      )
      .pipe(map((response) => response.data));
  }

  private extractRows(payload: OpsSupportTicketListResponse['data']): OpsSupportTicketRow[] {
    if (Array.isArray(payload)) {
      return payload;
    }
    return payload?.data ?? [];
  }
}
