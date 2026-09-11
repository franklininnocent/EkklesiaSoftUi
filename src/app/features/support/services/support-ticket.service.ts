import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '@environments/environment';
import {
  CreateSupportTicketPayload,
  SupportLookupType,
  SupportTicketDashboard,
  SupportTicketDetail,
  SupportTicketListItem,
} from '../models/support-ticket.model';

interface Paginated<T> {
  success: boolean;
  data: T[];
  total: number;
  current_page: number;
  last_page: number;
  per_page: number;
}

@Injectable({ providedIn: 'root' })
export class SupportTicketService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/tenant/support`;

  getDashboard(): Observable<SupportTicketDashboard> {
    return this.http
      .get<{ success: boolean; data: SupportTicketDashboard }>(`${this.base}/dashboard`)
      .pipe(map((r) => r.data));
  }

  getLookups(): Observable<SupportLookupType[]> {
    return this.http
      .get<{ success: boolean; data: { request_types: SupportLookupType[] } }>(`${this.base}/lookups`)
      .pipe(map((r) => r.data.request_types));
  }

  listTickets(filters: Record<string, string | number | undefined>): Observable<Paginated<SupportTicketListItem>> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });

    return this.http.get<Paginated<SupportTicketListItem>>(`${this.base}/tickets`, { params });
  }

  getTicket(idOrNumber: string): Observable<SupportTicketDetail> {
    return this.http
      .get<{ success: boolean; data: SupportTicketDetail }>(`${this.base}/tickets/${encodeURIComponent(idOrNumber)}`)
      .pipe(map((r) => r.data));
  }

  createTicket(payload: CreateSupportTicketPayload): Observable<SupportTicketDetail> {
    return this.http
      .post<{ success: boolean; data: SupportTicketDetail }>(`${this.base}/tickets`, payload)
      .pipe(map((r) => r.data));
  }

  addComment(ticketId: string, body: string): Observable<unknown> {
    return this.http.post(`${this.base}/tickets/${encodeURIComponent(ticketId)}/comments`, { body });
  }

  resolveTicket(ticketId: string, resolutionSummary?: string): Observable<SupportTicketDetail> {
    const payload = resolutionSummary?.trim()
      ? { resolution_summary: resolutionSummary.trim() }
      : {};
    return this.http
      .post<{ success: boolean; data: SupportTicketDetail }>(
        `${this.base}/tickets/${encodeURIComponent(ticketId)}/resolve`,
        payload
      )
      .pipe(map((r) => r.data));
  }

  cancelTicket(ticketId: string, reason: string): Observable<SupportTicketDetail> {
    return this.http
      .post<{ success: boolean; data: SupportTicketDetail }>(
        `${this.base}/tickets/${encodeURIComponent(ticketId)}/cancel`,
        { reason }
      )
      .pipe(map((r) => r.data));
  }

  reopenTicket(ticketId: string, reason: string): Observable<SupportTicketDetail> {
    return this.http
      .post<{ success: boolean; data: SupportTicketDetail }>(
        `${this.base}/tickets/${encodeURIComponent(ticketId)}/reopen`,
        { reason }
      )
      .pipe(map((r) => r.data));
  }

  confirmResolution(ticketId: string): Observable<SupportTicketDetail> {
    return this.http
      .post<{ success: boolean; data: SupportTicketDetail }>(
        `${this.base}/tickets/${encodeURIComponent(ticketId)}/confirm-resolution`,
        {}
      )
      .pipe(map((r) => r.data));
  }

  downloadAttachment(ticketId: string, attachmentId: number): Observable<Blob> {
    return this.http.get(
      `${this.base}/tickets/${encodeURIComponent(ticketId)}/attachments/${attachmentId}/download`,
      { responseType: 'blob' }
    );
  }
}
