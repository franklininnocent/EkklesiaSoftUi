import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '@environments/environment';
import {
  ContributionDue,
  ContributionPlan,
  ContributionPlanAssignment,
  DonationCategory,
  CollectionForecast,
  DioceseRollupDashboard,
  DonationSavedViewPreset,
  DonationSavedViewResult,
  FinancialGlobalSearchResult,
  DonationDashboardSummary,
  FinancialCommandCenterPayload,
  ParishExpenseRecord,
  OperationsDashboardSummary,
  FinancialActivityTimeline,
  ExecutiveReportSummary,
  ParishComparisonReport,
  FinancialAiStatus,
  DonationEntry,
  DonationFamilyFinancialProfile,
  DonationFamilySummary,
  FinancialAiResponse,
  ReceiptOcrResult,
  UpiPaymentIntent,
  WhatsAppOutreachPreview,
  WhatsAppDeliverySummary,
  PaymentBatch,
  DonationNotificationLog,
  DonationPayment,
  DonationProject,
  DonationReportExport,
  DonationSettings,
  Donor,
  DonationAuditLog,
  DonationReceiptListItem,
  DonationReceiptPreview,
  PaginatedResponse,
  PlanRevisionHistory,
  ProjectDashboard,
  ProjectFamilyAssignment,
  ProjectInstallmentDue,
  RecurringDonationSchedule
} from '../models/donation.model';

@Injectable({ providedIn: 'root' })
export class DonationsService {
  private baseUrl = `${environment.apiUrl}/tenant/donations`;

  constructor(private http: HttpClient) {}

  getDashboardSummary(): Observable<{ success: boolean; data: DonationDashboardSummary }> {
    return this.http.get<{ success: boolean; data: DonationDashboardSummary }>(`${this.baseUrl}/dashboard/summary`);
  }

  getCommandCenter(period = 'month'): Observable<{ success: boolean; data: FinancialCommandCenterPayload }> {
    const params = new HttpParams().set('period', period);
    return this.http.get<{ success: boolean; data: FinancialCommandCenterPayload }>(`${this.baseUrl}/dashboard/command-center`, { params });
  }

  createParishExpense(payload: Record<string, unknown>): Observable<{ success: boolean; message: string; data: ParishExpenseRecord }> {
    return this.http.post<{ success: boolean; message: string; data: ParishExpenseRecord }>(`${this.baseUrl}/expenses`, payload);
  }

  getParishExpenses(): Observable<{ success: boolean; data: ParishExpenseRecord[] }> {
    return this.http.get<{ success: boolean; data: ParishExpenseRecord[] }>(`${this.baseUrl}/expenses`);
  }

  getOperationsDashboard(): Observable<{ success: boolean; data: OperationsDashboardSummary }> {
    return this.http.get<{ success: boolean; data: OperationsDashboardSummary }>(`${this.baseUrl}/dashboard/operations`);
  }

  getActivityTimeline(subjectType: string, subjectId: string): Observable<{ success: boolean; data: FinancialActivityTimeline }> {
    const params = new HttpParams().set('subject_type', subjectType).set('subject_id', subjectId);
    return this.http.get<{ success: boolean; data: FinancialActivityTimeline }>(`${this.baseUrl}/activity/timeline`, { params });
  }

  getExecutiveReportSummary(): Observable<{ success: boolean; data: ExecutiveReportSummary }> {
    return this.http.get<{ success: boolean; data: ExecutiveReportSummary }>(`${this.baseUrl}/reports/executive-summary`);
  }

  getParishComparisonReport(): Observable<{ success: boolean; data: ParishComparisonReport }> {
    return this.http.get<{ success: boolean; data: ParishComparisonReport }>(`${this.baseUrl}/reports/parish-comparison`);
  }

  getStewardshipPrintHtml(): Observable<string> {
    return this.http.get(`${this.baseUrl}/reports/stewardship/print`, { responseType: 'text' });
  }

  getExecutiveBoardPrintHtml(): Observable<string> {
    return this.http.get(`${this.baseUrl}/reports/executive-board/print`, { responseType: 'text' });
  }

  getFinancialAiStatus(): Observable<{ success: boolean; data: FinancialAiStatus }> {
    return this.http.get<{ success: boolean; data: FinancialAiStatus }>(`${this.baseUrl}/ai/status`);
  }

  askFinancialAssistant(prompt: string): Observable<{ success: boolean; data: FinancialAiResponse }> {
    return this.http.post<{ success: boolean; data: FinancialAiResponse }>(`${this.baseUrl}/ai/ask`, { prompt });
  }

  getDioceseRollup(): Observable<{ success: boolean; data: DioceseRollupDashboard }> {
    return this.http.get<{ success: boolean; data: DioceseRollupDashboard }>(`${this.baseUrl}/dashboard/rollup`);
  }

  getUpiIntent(amount: number, familyId?: string, note?: string): Observable<{ success: boolean; data: UpiPaymentIntent }> {
    let params = new HttpParams().set('amount', String(amount));
    if (familyId) {
      params = params.set('family_id', familyId);
    }
    if (note) {
      params = params.set('note', note);
    }
    return this.http.get<{ success: boolean; data: UpiPaymentIntent }>(`${this.baseUrl}/upi/intent`, { params });
  }

  getCollectionForecast(months = 3): Observable<{ success: boolean; data: CollectionForecast }> {
    const params = new HttpParams().set('months', String(months));
    return this.http.get<{ success: boolean; data: CollectionForecast }>(`${this.baseUrl}/dashboard/forecast`, { params });
  }

  scanReceiptOcr(payload: { extracted_text?: string; receipt_image?: File }): Observable<{ success: boolean; data: ReceiptOcrResult }> {
    const formData = new FormData();
    if (payload.extracted_text) {
      formData.append('extracted_text', payload.extracted_text);
    }
    if (payload.receipt_image) {
      formData.append('receipt_image', payload.receipt_image);
    }
    return this.http.post<{ success: boolean; data: ReceiptOcrResult }>(`${this.baseUrl}/payments/ocr-scan`, formData);
  }

  previewWhatsAppOutreach(familyIds?: string[]): Observable<{ success: boolean; data: WhatsAppOutreachPreview }> {
    let params = new HttpParams();
    if (familyIds?.length) {
      familyIds.forEach((id) => {
        params = params.append('family_ids[]', id);
      });
    }
    return this.http.get<{ success: boolean; data: WhatsAppOutreachPreview }>(`${this.baseUrl}/outreach/whatsapp/preview`, { params });
  }

  queueWhatsAppOutreach(familyIds: string[], message?: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.baseUrl}/outreach/whatsapp/queue`, {
      family_ids: familyIds,
      message
    });
  }

  deliverPendingWhatsApp(limit = 25): Observable<{ success: boolean; message: string; data: { processed: number; delivered: number } }> {
    return this.http.post<{ success: boolean; message: string; data: { processed: number; delivered: number } }>(
      `${this.baseUrl}/outreach/whatsapp/deliver-pending`,
      { limit }
    );
  }

  getWhatsAppDeliverySummary(): Observable<{ success: boolean; data: WhatsAppDeliverySummary }> {
    return this.http.get<{ success: boolean; data: WhatsAppDeliverySummary }>(`${this.baseUrl}/outreach/whatsapp/delivery-summary`);
  }

  searchFinancialEntities(query: string): Observable<{ success: boolean; data: FinancialGlobalSearchResult }> {
    const params = new HttpParams().set('q', query.trim());
    return this.http.get<{ success: boolean; data: FinancialGlobalSearchResult }>(`${this.baseUrl}/search`, { params });
  }

  getSavedViewPresets(): Observable<{ success: boolean; data: DonationSavedViewPreset[] }> {
    return this.http.get<{ success: boolean; data: DonationSavedViewPreset[] }>(`${this.baseUrl}/saved-views`);
  }

  applySavedView(key: string): Observable<{ success: boolean; data: DonationSavedViewResult }> {
    return this.http.get<{ success: boolean; data: DonationSavedViewResult }>(`${this.baseUrl}/saved-views/${key}`);
  }

  getFamilySummary(familyId: string): Observable<{ success: boolean; data: DonationFamilySummary }> {
    return this.getFamilyFinancialProfile(familyId).pipe(
      map((response) => ({
        success: response.success,
        data: {
          family_id: response.data.family_id,
          total_paid: response.data.totals.total_paid,
          pending_due: response.data.totals.pending_due,
          pending_mandatory_due: response.data.totals.pending_mandatory_due,
          pending_project_due: response.data.totals.pending_project_due,
          overdue_count: response.data.totals.overdue_count
        }
      }))
    );
  }

  getFamilyFinancialProfile(familyId: string): Observable<{ success: boolean; data: DonationFamilyFinancialProfile }> {
    return this.http.get<{ success: boolean; data: DonationFamilyFinancialProfile }>(
      `${this.baseUrl}/families/${familyId}/financial-profile`
    );
  }

  getFunds(): Observable<{ success: boolean; data: Array<{ id: string; name: string; code: string }> }> {
    return this.http.get<{ success: boolean; data: Array<{ id: string; name: string; code: string }> }>(`${this.baseUrl}/funds`);
  }

  createFund(payload: { name: string; code?: string; status?: string }): Observable<{ success: boolean; message: string; data: { id: string; name: string; code: string } }> {
    return this.http.post<{ success: boolean; message: string; data: { id: string; name: string; code: string } }>(
      `${this.baseUrl}/funds`,
      payload
    );
  }

  getPlans(): Observable<{ success: boolean; data: ContributionPlan[] }> {
    return this.http.get<{ success: boolean; data: ContributionPlan[] }>(`${this.baseUrl}/plans`);
  }

  getPlan(planId: string): Observable<{ success: boolean; data: ContributionPlan }> {
    return this.http.get<{ success: boolean; data: ContributionPlan }>(`${this.baseUrl}/plans/${planId}`);
  }

  createPlan(payload: Record<string, unknown>): Observable<{ success: boolean; message: string; data: ContributionPlan }> {
    return this.http.post<{ success: boolean; message: string; data: ContributionPlan }>(`${this.baseUrl}/plans`, payload);
  }

  updatePlan(planId: string, payload: Record<string, unknown>): Observable<{ success: boolean; message: string; data: ContributionPlan }> {
    return this.http.put<{ success: boolean; message: string; data: ContributionPlan }>(`${this.baseUrl}/plans/${planId}`, payload);
  }

  getPlanAssignments(planId: string, page = 1): Observable<{ success: boolean; data: PaginatedResponse<ContributionPlanAssignment> }> {
    const params = new HttpParams().set('per_page', '100').set('page', String(page));
    return this.http.get<{ success: boolean; data: PaginatedResponse<ContributionPlanAssignment> }>(
      `${this.baseUrl}/plans/${planId}/assignments`,
      { params }
    );
  }

  savePlanAssignment(planId: string, payload: Record<string, unknown>): Observable<{ success: boolean; message: string; data: ContributionPlanAssignment }> {
    return this.http.post<{ success: boolean; message: string; data: ContributionPlanAssignment }>(
      `${this.baseUrl}/plans/${planId}/assignments`,
      payload
    );
  }

  getPlanRevisionHistory(planId: string): Observable<{ success: boolean; data: PaginatedResponse<PlanRevisionHistory> }> {
    return this.http.get<{ success: boolean; data: PaginatedResponse<PlanRevisionHistory> }>(
      `${this.baseUrl}/plans/${planId}/revision-history`
    );
  }

  generatePlanDues(planId: string, payload: Record<string, unknown> = {}): Observable<{ success: boolean; message: string; data: ContributionDue[] }> {
    return this.http.post<{ success: boolean; message: string; data: ContributionDue[] }>(
      `${this.baseUrl}/plans/${planId}/generate-dues`,
      payload
    );
  }

  generateScheduledContributions(): Observable<{ success: boolean; message: string; data: { processed: number; generated: number } }> {
    return this.http.post<{ success: boolean; message: string; data: { processed: number; generated: number } }>(
      `${this.baseUrl}/contributions/generate-scheduled`,
      {}
    );
  }

  getDues(filters: Record<string, string | boolean> = {}): Observable<{ success: boolean; data: PaginatedResponse<ContributionDue> }> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http.get<{ success: boolean; data: PaginatedResponse<ContributionDue> }>(`${this.baseUrl}/dues`, { params });
  }

  waiveDue(dueId: string, reason?: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.baseUrl}/dues/${dueId}/waive`, { reason });
  }

  cancelDue(dueId: string, reason?: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.baseUrl}/dues/${dueId}/cancel`, { reason });
  }

  remindDue(dueId: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.baseUrl}/dues/${dueId}/remind`, {});
  }

  getProjects(): Observable<{ success: boolean; data: DonationProject[] }> {
    return this.http.get<{ success: boolean; data: DonationProject[] }>(`${this.baseUrl}/projects`);
  }

  getProject(projectId: string): Observable<{ success: boolean; data: DonationProject }> {
    return this.http.get<{ success: boolean; data: DonationProject }>(`${this.baseUrl}/projects/${projectId}`);
  }

  getProjectDashboard(projectId: string): Observable<{ success: boolean; data: ProjectDashboard }> {
    return this.http.get<{ success: boolean; data: ProjectDashboard }>(`${this.baseUrl}/projects/${projectId}/dashboard`);
  }

  createProject(payload: Record<string, unknown>): Observable<{ success: boolean; message: string; data: DonationProject }> {
    return this.http.post<{ success: boolean; message: string; data: DonationProject }>(`${this.baseUrl}/projects`, payload);
  }

  updateProject(projectId: string, payload: Record<string, unknown>): Observable<{ success: boolean; message: string; data: DonationProject }> {
    return this.http.put<{ success: boolean; message: string; data: DonationProject }>(`${this.baseUrl}/projects/${projectId}`, payload);
  }

  saveProjectAssignment(projectId: string, payload: Record<string, unknown>): Observable<{ success: boolean; message: string; data: ProjectFamilyAssignment }> {
    return this.http.post<{ success: boolean; message: string; data: ProjectFamilyAssignment }>(
      `${this.baseUrl}/projects/${projectId}/assignments`,
      payload
    );
  }

  generateProjectInstallments(projectId: string, payload: Record<string, unknown> = {}): Observable<{ success: boolean; message: string; data: ProjectInstallmentDue[] }> {
    return this.http.post<{ success: boolean; message: string; data: ProjectInstallmentDue[] }>(
      `${this.baseUrl}/projects/${projectId}/generate-installments`,
      payload
    );
  }

  getProjectInstallments(filters: Record<string, string | boolean> = {}): Observable<{ success: boolean; data: PaginatedResponse<ProjectInstallmentDue> }> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http.get<{ success: boolean; data: PaginatedResponse<ProjectInstallmentDue> }>(
      `${this.baseUrl}/project-installments`,
      { params }
    );
  }

  waiveProjectInstallment(installmentId: string, reason?: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.baseUrl}/project-installments/${installmentId}/waive`, { reason });
  }

  cancelProjectInstallment(installmentId: string, reason?: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.baseUrl}/project-installments/${installmentId}/cancel`, { reason });
  }

  getPayments(filters: Record<string, string> = {}): Observable<{ success: boolean; data: PaginatedResponse<DonationPayment> }> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params = params.set(key, value);
      }
    });
    return this.http.get<{ success: boolean; data: PaginatedResponse<DonationPayment> }>(`${this.baseUrl}/payments`, { params });
  }

  getPaymentsLegacy(): Observable<{ success: boolean; data: { data: DonationPayment[] } }> {
    return this.getPayments().pipe(
      map((response) => ({
        success: response.success,
        data: { data: response.data?.data ?? [] }
      }))
    );
  }

  createPayment(payload: Record<string, unknown>): Observable<{ success: boolean; message: string; data?: DonationPayment }> {
    return this.http.post<{ success: boolean; message: string; data?: DonationPayment }>(`${this.baseUrl}/payments`, payload);
  }

  exportReport(payload: Record<string, unknown>): Observable<{ success: boolean; data: DonationReportExport }> {
    return this.http.post<{ success: boolean; data: DonationReportExport }>(`${this.baseUrl}/reports/export`, payload);
  }

  listExports(): Observable<{ success: boolean; data: { data: DonationReportExport[] } }> {
    return this.http.get<{ success: boolean; data: { data: DonationReportExport[] } }>(`${this.baseUrl}/reports/exports`);
  }

  getReceiptPreview(paymentId: string): Observable<{ success: boolean; data: DonationReceiptPreview }> {
    return this.http.get<{ success: boolean; data: DonationReceiptPreview }>(`${this.baseUrl}/payments/${paymentId}/receipt`);
  }

  getReceiptPrintHtml(paymentId: string): Observable<string> {
    return this.http.get(`${this.baseUrl}/payments/${paymentId}/receipt/print`, { responseType: 'text' });
  }

  getFamilyStatementPrintHtml(familyId: string): Observable<string> {
    return this.http.get(`${this.baseUrl}/families/${familyId}/financial-profile/print`, { responseType: 'text' });
  }

  listNotifications(filters: Record<string, string> = {}): Observable<{ success: boolean; data: PaginatedResponse<DonationNotificationLog> }> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params = params.set(key, value);
      }
    });
    return this.http.get<{ success: boolean; data: PaginatedResponse<DonationNotificationLog> }>(`${this.baseUrl}/notifications`, { params });
  }

  getCampaigns(): Observable<{ success: boolean; data: DonationProject[] }> {
    return this.http.get<{ success: boolean; data: DonationProject[] }>(`${this.baseUrl}/campaigns`);
  }

  createCampaign(payload: Record<string, unknown>): Observable<{ success: boolean; message: string; data: DonationProject }> {
    return this.http.post<{ success: boolean; message: string; data: DonationProject }>(`${this.baseUrl}/campaigns`, payload);
  }

  getCampaignDashboard(campaignId: string): Observable<{ success: boolean; data: ProjectDashboard }> {
    return this.http.get<{ success: boolean; data: ProjectDashboard }>(`${this.baseUrl}/campaigns/${campaignId}/dashboard`);
  }

  getReceipts(filters: Record<string, string> = {}): Observable<{ success: boolean; data: PaginatedResponse<DonationReceiptListItem> }> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params = params.set(key, value);
      }
    });
    return this.http.get<{ success: boolean; data: PaginatedResponse<DonationReceiptListItem> }>(`${this.baseUrl}/receipts`, { params });
  }

  getCategories(): Observable<{ success: boolean; data: DonationCategory[] }> {
    return this.http.get<{ success: boolean; data: DonationCategory[] }>(`${this.baseUrl}/categories`);
  }

  createCategory(payload: Record<string, unknown>): Observable<{ success: boolean; message: string; data: DonationCategory }> {
    return this.http.post<{ success: boolean; message: string; data: DonationCategory }>(`${this.baseUrl}/categories`, payload);
  }

  updateCategory(categoryId: string, payload: Record<string, unknown>): Observable<{ success: boolean; message: string; data: DonationCategory }> {
    return this.http.put<{ success: boolean; message: string; data: DonationCategory }>(`${this.baseUrl}/categories/${categoryId}`, payload);
  }

  deleteCategory(categoryId: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.baseUrl}/categories/${categoryId}`);
  }

  seedDefaultCategories(): Observable<{ success: boolean; message: string; data: DonationCategory[] }> {
    return this.http.post<{ success: boolean; message: string; data: DonationCategory[] }>(`${this.baseUrl}/categories/seed-defaults`, {});
  }

  getDonors(search = ''): Observable<{ success: boolean; data: PaginatedResponse<Donor> }> {
    let params = new HttpParams().set('per_page', '100');
    if (search) {
      params = params.set('search', search);
    }
    return this.http.get<{ success: boolean; data: PaginatedResponse<Donor> }>(`${this.baseUrl}/donors`, { params });
  }

  createDonor(payload: Record<string, unknown>): Observable<{ success: boolean; message: string; data: Donor }> {
    return this.http.post<{ success: boolean; message: string; data: Donor }>(`${this.baseUrl}/donors`, payload);
  }

  updateDonor(donorId: string, payload: Record<string, unknown>): Observable<{ success: boolean; message: string; data: Donor }> {
    return this.http.put<{ success: boolean; message: string; data: Donor }>(`${this.baseUrl}/donors/${donorId}`, payload);
  }

  collectVoluntaryDonation(payload: Record<string, unknown>): Observable<{ success: boolean; message: string; data: { donation: DonationEntry; payment: DonationPayment } }> {
    return this.http.post<{ success: boolean; message: string; data: { donation: DonationEntry; payment: DonationPayment } }>(
      `${this.baseUrl}/entries/collect`,
      payload
    );
  }

  updateDonationEntry(entryId: string, payload: Record<string, unknown>): Observable<{ success: boolean; message: string; data: DonationEntry }> {
    return this.http.put<{ success: boolean; message: string; data: DonationEntry }>(`${this.baseUrl}/entries/${entryId}`, payload);
  }

  createDonationEntry(payload: Record<string, unknown>): Observable<{ success: boolean; message: string; data: DonationEntry }> {
    return this.http.post<{ success: boolean; message: string; data: DonationEntry }>(`${this.baseUrl}/entries`, payload);
  }

  getDonationEntries(filters: Record<string, string | boolean> = {}): Observable<{ success: boolean; data: PaginatedResponse<DonationEntry> }> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http.get<{ success: boolean; data: PaginatedResponse<DonationEntry> }>(`${this.baseUrl}/entries`, { params });
  }

  getSettings(): Observable<{ success: boolean; data: DonationSettings | null }> {
    return this.http.get<{ success: boolean; data: DonationSettings | null }>(`${this.baseUrl}/settings`);
  }

  updateSettings(payload: Record<string, unknown>): Observable<{ success: boolean; message: string; data: DonationSettings }> {
    return this.http.put<{ success: boolean; message: string; data: DonationSettings }>(`${this.baseUrl}/settings`, payload);
  }

  getPaymentBatches(): Observable<{ success: boolean; data: { data: PaymentBatch[] } }> {
    return this.http.get<{ success: boolean; data: { data: PaymentBatch[] } }>(`${this.baseUrl}/payment-batches`);
  }

  createPaymentBatch(payload: Record<string, unknown>): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.baseUrl}/payment-batches`, payload);
  }

  uploadPaymentBatch(payload: Record<string, unknown>): Observable<{ success: boolean; message: string; data: unknown }> {
    return this.http.post<{ success: boolean; message: string; data: unknown }>(`${this.baseUrl}/payment-batches/upload`, payload);
  }

  getRecurringSchedules(): Observable<{ success: boolean; data: { data: RecurringDonationSchedule[] } }> {
    return this.http.get<{ success: boolean; data: { data: RecurringDonationSchedule[] } }>(`${this.baseUrl}/recurring-schedules`);
  }

  createRecurringSchedule(payload: Record<string, unknown>): Observable<{ success: boolean; message: string; data: RecurringDonationSchedule }> {
    return this.http.post<{ success: boolean; message: string; data: RecurringDonationSchedule }>(`${this.baseUrl}/recurring-schedules`, payload);
  }

  updateRecurringSchedule(scheduleId: string, payload: Record<string, unknown>): Observable<{ success: boolean; message: string; data: RecurringDonationSchedule }> {
    return this.http.put<{ success: boolean; message: string; data: RecurringDonationSchedule }>(`${this.baseUrl}/recurring-schedules/${scheduleId}`, payload);
  }

  pauseRecurringSchedule(scheduleId: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.baseUrl}/recurring-schedules/${scheduleId}/pause`, {});
  }

  cancelRecurringSchedule(scheduleId: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.baseUrl}/recurring-schedules/${scheduleId}/cancel`, {});
  }

  getAuditLogs(filters: Record<string, string> = {}): Observable<{ success: boolean; data: PaginatedResponse<DonationAuditLog> }> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params = params.set(key, value);
      }
    });
    return this.http.get<{ success: boolean; data: PaginatedResponse<DonationAuditLog> }>(`${this.baseUrl}/audit-logs`, { params });
  }

  runDueRecurringSchedules(): Observable<{ success: boolean; message: string; data: { processed: number; succeeded: number; failed: number } }> {
    return this.http.post<{ success: boolean; message: string; data: { processed: number; succeeded: number; failed: number } }>(
      `${this.baseUrl}/recurring-schedules/run-due`,
      {}
    );
  }
}
