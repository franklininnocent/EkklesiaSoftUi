import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';
import { environment } from '@environments/environment';

export interface MassIntentionsTrendPoint {
  month: string;
  label: string;
  /** @deprecated legacy obligation workflow */
  accepted?: number;
  /** @deprecated legacy obligation workflow */
  said?: number;
  registered?: number;
  closed?: number;
  offering?: string;
  is_current?: boolean;
}

export interface MassIntentionsUpcomingCelebration {
  id: string;
  celebrated_on: string | null;
  celebrated_at?: string | null;
  place?: string | null;
  celebrant_name?: string | null;
}

export interface MassIntentionsHomeSummary {
  queue: {
    open: number;
    closed: number;
  };
  kpis?: {
    open: number;
    closed: number;
    intentions_registered_this_month: number;
    intentions_registered_last_month?: number;
    offering_received_this_month?: string;
    offering_received_last_month?: string;
    receipts_this_month?: number;
  };
  requests?: {
    open: number;
    closed: number;
  };
  period: {
    label?: string;
    intentions_registered_this_month: number;
    intentions_registered_last_month?: number;
    offering_received_this_month?: string | null;
    offering_received_last_month?: string | null;
  };
  offerings?: {
    received_this_month: string;
    received_last_month: string;
    receipts_this_month: number;
  };
  trend?: MassIntentionsTrendPoint[];
}

export interface MassIntentionCategory {
  id: string;
  code: string;
  name: string;
  active: boolean;
  sort_order: number;
}

export interface MassIntentionBeneficiaryBcc {
  id?: string | null;
  name?: string | null;
}

export interface MassIntentionRecord {
  id: string;
  status: string;
  beneficiary_person_id?: string | null;
  beneficiary_name: string;
  beneficiary_place?: string | null;
  beneficiary_bcc?: MassIntentionBeneficiaryBcc | null;
  mass_intention_category_id?: string | null;
  intention_text: string;
  intention_description?: string | null;
  priest_text?: string | null;
  notes?: string | null;
  announce_name: boolean;
  requester_name?: string | null;
  requester_phone?: string | null;
  requested_date?: string | null;
  date_must_be_kept: boolean;
  prohibit_transfer?: boolean;
  is_collective?: boolean;
  mass_count_requested?: number | null;
  mass_count_accepted?: number | null;
  said_progress?: { said: number; total: number } | null;
}

export interface MassCelebrationSummary {
  id: string;
  celebrated_on: string;
  celebrated_at?: string | null;
  place?: string | null;
  celebrant_name?: string | null;
  status?: string;
  intention_count?: number;
}

export interface PendingScheduleObligation {
  obligation_id: string;
  request_id: string;
  sequence: number;
  beneficiary_name: string;
  intention_text: string;
  requested_date?: string | null;
  date_must_be_kept?: boolean;
}

export interface MassCelebrationWorkspaceIntention {
  obligation_id: string;
  request_id: string;
  beneficiary_name: string;
  intention_text: string;
  sequence: number;
  mass_total: number;
  is_said: boolean;
  fulfilment_id?: string | null;
  fulfilled_at?: string | null;
}

export interface MassCelebrationWorkspace {
  celebration: MassCelebrationSummary;
  intentions: MassCelebrationWorkspaceIntention[];
  can_mark_said: boolean;
}

export interface MassOfferingReceipt {
  id: string;
  receipt_number: string;
  amount: string;
  payment_method: string;
  received_on: string;
}

export interface RegisterRow {
  request_id: string;
  beneficiary_name: string;
  intention_text: string;
  requested_date?: string | null;
  progress: string;
}

export interface MassListReportRow {
  celebration_id: string;
  celebrated_on: string;
  celebrated_at?: string | null;
  place?: string | null;
  celebrant_name?: string | null;
  status: string;
  intention_count: number;
}

export interface StillToSayReportRow {
  obligation_id: string;
  beneficiary_name: string;
  intention_text: string;
  sequence: number;
  status: string;
}

export interface OfferingsReportRow {
  receipt_number: string;
  amount: string;
  payment_method: string;
  received_on: string;
  beneficiary_name: string;
  request_id: string;
}

export interface MassesSaidReportRow {
  said_on: string;
  mass_day?: string | null;
  beneficiary_name: string;
  intention_text: string;
  sequence: number;
  celebrant?: string | null;
}

export interface MassIntentionAuditRow {
  id: string;
  event_type: string;
  request_id?: string | null;
  celebration_id?: string | null;
  created_at?: string | null;
  payload?: Record<string, unknown> | null;
}

export interface MassIntentionSettings {
  suggested_offering_amount?: string | null;
  review_days: number;
  provincial_collective_authorized?: boolean;
  categories: string[];
}

@Injectable({ providedIn: 'root' })
export class MassIntentionsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/tenant/mass-intentions`;

  getModuleStatus(): Observable<{ success: boolean; data: { enabled: boolean } }> {
    return this.http.get<{ success: boolean; data: { enabled: boolean } }>(
      `${this.base}/module-status`
    );
  }

  getHome(): Observable<{ success: boolean; data: MassIntentionsHomeSummary }> {
    return this.http.get<{ success: boolean; data: MassIntentionsHomeSummary }>(`${this.base}/dashboard`);
  }

  downloadRegisterPdf(params: Record<string, string | number> = {}): Observable<Blob> {
    return this.http.get(`${this.base}/requests/export/pdf`, {
      params,
      responseType: 'blob',
    });
  }

  listRequests(params: Record<string, string | number> = {}): Observable<{
    success: boolean;
    data: MassIntentionRecord[];
    total?: number;
    last_page?: number;
    current_page?: number;
  }> {
    return this.http.get<{
      success: boolean;
      data: MassIntentionRecord[];
      total?: number;
      last_page?: number;
      current_page?: number;
    }>(`${this.base}/requests`, {
      params,
    });
  }

  /** Fetches every page for the same filter params (export / print). */
  listAllRequests(params: Record<string, string | number> = {}): Observable<MassIntentionRecord[]> {
    const perPage = 100;
    const fetchPage = (page: number) =>
      this.listRequests({ ...params, page, per_page: perPage });

    return fetchPage(1).pipe(
      switchMap((first) => {
        const lastPage = first.last_page ?? 1;
        if (lastPage <= 1) {
          return of(first.data ?? []);
        }
        const rest = Array.from({ length: lastPage - 1 }, (_, index) => fetchPage(index + 2));
        return forkJoin(rest).pipe(
          map((pages) => [
            ...(first.data ?? []),
            ...pages.flatMap((page) => page.data ?? []),
          ]),
        );
      }),
    );
  }

  getRequest(id: string): Observable<{
    success: boolean;
    data: MassIntentionRecord;
    meta?: { upcoming_celebrations?: MassCelebrationSummary[]; receipts?: MassOfferingReceipt[] };
  }> {
    return this.http.get<{
      success: boolean;
      data: MassIntentionRecord;
      meta?: { upcoming_celebrations?: MassCelebrationSummary[]; receipts?: MassOfferingReceipt[] };
    }>(`${this.base}/requests/${id}`);
  }

  createRequest(body: Record<string, unknown>): Observable<{
    success: boolean;
    data: MassIntentionRecord;
    meta?: { similar?: MassIntentionRecord[] };
  }> {
    return this.http.post<{ success: boolean; data: MassIntentionRecord; meta?: { similar?: MassIntentionRecord[] } }>(
      `${this.base}/requests`,
      body
    );
  }

  updateRequest(id: string, body: Record<string, unknown>): Observable<{ success: boolean; data: MassIntentionRecord }> {
    return this.http.put<{ success: boolean; data: MassIntentionRecord }>(`${this.base}/requests/${id}`, body);
  }

  acceptRequest(
    id: string,
    body: Record<string, unknown>
  ): Observable<{
    success: boolean;
    data: MassIntentionRecord;
    meta?: { upcoming_celebrations?: MassCelebrationSummary[]; last_receipt?: MassOfferingReceipt };
  }> {
    return this.http.post<{
      success: boolean;
      data: MassIntentionRecord;
      meta?: { upcoming_celebrations?: MassCelebrationSummary[]; last_receipt?: MassOfferingReceipt };
    }>(`${this.base}/requests/${id}/accept`, body);
  }

  requestClarification(id: string, message: string): Observable<{ success: boolean; data: MassIntentionRecord }> {
    return this.http.post<{ success: boolean; data: MassIntentionRecord }>(
      `${this.base}/requests/${id}/request-clarification`,
      { message }
    );
  }

  withdrawRequest(id: string): Observable<{ success: boolean; data: MassIntentionRecord }> {
    return this.http.post<{ success: boolean; data: MassIntentionRecord }>(
      `${this.base}/requests/${id}/withdraw`,
      {}
    );
  }

  closeRequest(id: string): Observable<{ success: boolean; data: MassIntentionRecord }> {
    return this.http.post<{ success: boolean; data: MassIntentionRecord }>(
      `${this.base}/requests/${id}/close`,
      {}
    );
  }

  scheduleRequest(
    id: string,
    celebrationId: string,
    dateVarianceReason?: string
  ): Observable<{ success: boolean; data: MassIntentionRecord }> {
    return this.http.post<{ success: boolean; data: MassIntentionRecord }>(
      `${this.base}/requests/${id}/schedule`,
      {
        celebration_id: celebrationId,
        date_variance_reason: dateVarianceReason || undefined,
      }
    );
  }

  listCelebrations(params: Record<string, string | number> = {}): Observable<{
    success: boolean;
    data: MassCelebrationSummary[];
    total?: number;
    current_page?: number;
    last_page?: number;
  }> {
    return this.http.get<{
      success: boolean;
      data: MassCelebrationSummary[];
      total?: number;
      current_page?: number;
      last_page?: number;
    }>(`${this.base}/celebrations`, {
      params,
    });
  }

  createCelebration(body: Record<string, unknown>): Observable<{ success: boolean; data: MassCelebrationSummary }> {
    return this.http.post<{ success: boolean; data: MassCelebrationSummary }>(`${this.base}/celebrations`, body);
  }

  updateCelebration(
    id: string,
    body: Record<string, unknown>
  ): Observable<{ success: boolean; data: MassCelebrationSummary }> {
    return this.http.put<{ success: boolean; data: MassCelebrationSummary }>(`${this.base}/celebrations/${id}`, body);
  }

  listTransferTargets(): Observable<{ success: boolean; data: { tenant_id: number; name: string }[] }> {
    return this.http.get<{ success: boolean; data: { tenant_id: number; name: string }[] }>(
      `${this.base}/transfers/targets`
    );
  }

  listPendingTransfers(): Observable<{
    success: boolean;
    data: {
      id: string;
      request_id: string;
      from_tenant_id: number;
      from_tenant_name?: string | null;
      beneficiary_name?: string | null;
      intention_text?: string | null;
      note?: string | null;
    }[];
  }> {
    return this.http.get<{
      success: boolean;
      data: {
        id: string;
        request_id: string;
        from_tenant_id: number;
        from_tenant_name?: string | null;
        beneficiary_name?: string | null;
        intention_text?: string | null;
        note?: string | null;
      }[];
    }>(`${this.base}/transfers/pending`);
  }

  initiateTransfer(requestId: string, toTenantId: number, note?: string): Observable<{ success: boolean; data: { id: string } }> {
    return this.http.post<{ success: boolean; data: { id: string } }>(
      `${this.base}/requests/${requestId}/transfer`,
      { to_tenant_id: toTenantId, note }
    );
  }

  acceptTransfer(transferId: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.base}/transfers/${transferId}/accept`, {});
  }

  rejectTransfer(transferId: string, note?: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.base}/transfers/${transferId}/reject`, { note });
  }

  listAudits(params: Record<string, string | number> = {}): Observable<{
    success: boolean;
    data: MassIntentionAuditRow[];
    total?: number;
  }> {
    return this.http.get<{ success: boolean; data: MassIntentionAuditRow[]; total?: number }>(
      `${this.base}/audits`,
      { params }
    );
  }

  getDonationsLedgerBridge(): Observable<{ success: boolean; data: unknown[]; meta?: Record<string, string> }> {
    return this.http.get<{ success: boolean; data: unknown[]; meta?: Record<string, string> }>(
      `${this.base}/reports/donations-ledger-bridge`
    );
  }

  listPendingScheduleObligations(): Observable<{ success: boolean; data: PendingScheduleObligation[] }> {
    return this.http.get<{ success: boolean; data: PendingScheduleObligation[] }>(
      `${this.base}/obligations/pending-schedule`
    );
  }

  assignObligationsToCelebration(
    celebrationId: string,
    obligationIds: string[],
    dateVarianceReason?: string
  ): Observable<{ success: boolean; data: MassCelebrationWorkspace }> {
    return this.http.post<{ success: boolean; data: MassCelebrationWorkspace }>(
      `${this.base}/celebrations/${celebrationId}/assign-obligations`,
      {
        obligation_ids: obligationIds,
        date_variance_reason: dateVarianceReason || undefined,
      }
    );
  }

  getCelebrationWorkspace(id: string): Observable<{ success: boolean; data: MassCelebrationWorkspace }> {
    return this.http.get<{ success: boolean; data: MassCelebrationWorkspace }>(
      `${this.base}/celebrations/${id}/workspace`
    );
  }

  confirmSaid(
    celebrationId: string,
    obligationIds: string[],
    celebrantOverrides: Record<string, string> = {}
  ): Observable<{ success: boolean; data: MassCelebrationWorkspace }> {
    const overrides: Record<string, string> = {};
    for (const id of obligationIds) {
      const name = celebrantOverrides[id]?.trim();
      if (name) {
        overrides[id] = name;
      }
    }
    return this.http.post<{ success: boolean; data: MassCelebrationWorkspace }>(
      `${this.base}/celebrations/${celebrationId}/confirm-said`,
      {
        obligation_ids: obligationIds,
        celebrant_overrides: Object.keys(overrides).length ? overrides : undefined,
      }
    );
  }

  undoFulfilment(fulfilmentId: string, reason: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.base}/fulfilments/${fulfilmentId}/undo`, { reason });
  }

  recordReceipt(
    requestId: string,
    body: { amount: string | number; payment_method?: string; received_on?: string }
  ): Observable<{ success: boolean; meta?: { receipts?: MassOfferingReceipt[] } }> {
    return this.http.post<{ success: boolean; meta?: { receipts?: MassOfferingReceipt[] } }>(
      `${this.base}/requests/${requestId}/receipts`,
      body
    );
  }

  voidReceipt(receiptId: string, reason: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.base}/receipts/${receiptId}/void`, { reason });
  }

  cancelCelebration(
    celebrationId: string,
    body: { reason: string; reassignments?: { obligation_id: string; celebration_id?: string | null }[] }
  ): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.base}/celebrations/${celebrationId}/cancel`, body);
  }

  getCanonicalRegister(): Observable<{ success: boolean; data: RegisterRow[] }> {
    return this.http.get<{ success: boolean; data: RegisterRow[] }>(`${this.base}/reports/canonical-register`);
  }

  getMassListReport(): Observable<{ success: boolean; data: MassListReportRow[] }> {
    return this.http.get<{ success: boolean; data: MassListReportRow[] }>(`${this.base}/reports/mass-list`);
  }

  getStillToSayReport(): Observable<{ success: boolean; data: StillToSayReportRow[] }> {
    return this.http.get<{ success: boolean; data: StillToSayReportRow[] }>(`${this.base}/reports/still-to-say`);
  }

  getOfferingsReport(): Observable<{ success: boolean; data: OfferingsReportRow[] }> {
    return this.http.get<{ success: boolean; data: OfferingsReportRow[] }>(`${this.base}/reports/offerings`);
  }

  getMassesSaidReport(): Observable<{ success: boolean; data: MassesSaidReportRow[] }> {
    return this.http.get<{ success: boolean; data: MassesSaidReportRow[] }>(`${this.base}/reports/masses-said`);
  }

  listCategories(): Observable<{ success: boolean; data: MassIntentionCategory[] }> {
    return this.http.get<{ success: boolean; data: MassIntentionCategory[] }>(`${this.base}/categories`);
  }

  createCategory(body: { name: string }): Observable<{ success: boolean; data: MassIntentionCategory; message?: string }> {
    return this.http.post<{ success: boolean; data: MassIntentionCategory; message?: string }>(
      `${this.base}/categories`,
      body
    );
  }

  getSettings(): Observable<{ success: boolean; data: MassIntentionSettings }> {
    return this.http.get<{ success: boolean; data: MassIntentionSettings }>(`${this.base}/settings`);
  }

  updateSettings(body: Partial<MassIntentionSettings>): Observable<{ success: boolean; data: MassIntentionSettings }> {
    return this.http.put<{ success: boolean; data: MassIntentionSettings }>(`${this.base}/settings`, body);
  }
}
