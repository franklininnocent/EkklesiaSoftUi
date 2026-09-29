import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '@environments/environment';
import {
  AdminTenantSubscription,
  ApiEnvelope,
  ApproveUpgradeInput,
  AssignPlanInput,
  PageMeta,
  SubscriptionOverview,
  SubscriptionRevenue,
  TenantUsagePage,
  UpgradeRequestFilter,
  CatalogAuditEntry,
  EntitlementOverride,
  GrantOverrideInput,
  PlanChangePreview,
  CatalogFeature,
  CatalogPlan,
  EntitlementInput,
  FeatureFormValue,
  FeatureMatrix,
  MigrateTenantsResult,
  PagedEnvelope,
  PlanFormValue,
  PlanTenantRow,
  PlanVersion,
  PoliciesPayload,
  PoliciesUpdate,
  TaxConfigurationPayload,
  TaxConfigurationUpdate,
  TaxPreviewBreakdown,
  SubscriptionApiError,
  VersionImpact,
  VersionPreview,
  VersionTermsValue,
} from '../models/subscription-admin.models';
import { UpgradeRequest } from '../models/tenant-subscription.models';

/**
 * Platform subscription catalog API. Every call is authorized server-side
 * (platform role + permission); the UI only hides actions for convenience.
 */
@Injectable({ providedIn: 'root' })
export class SubscriptionAdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/subscriptions`;

  listPlans(options: { includeLegacy?: boolean; includeArchived?: boolean } = {}): Observable<CatalogPlan[]> {
    let params = new HttpParams();
    if (options.includeLegacy) params = params.set('include_legacy', '1');
    if (options.includeArchived) params = params.set('include_archived', '1');
    return this.http.get<ApiEnvelope<CatalogPlan[]>>(`${this.base}/plans`, { params }).pipe(map((r) => r.data));
  }

  getPlan(planId: number): Observable<CatalogPlan> {
    return this.http.get<ApiEnvelope<CatalogPlan>>(`${this.base}/plans/${planId}`).pipe(map((r) => r.data));
  }

  createPlan(value: PlanFormValue): Observable<CatalogPlan> {
    return this.http.post<ApiEnvelope<CatalogPlan>>(`${this.base}/plans`, value).pipe(map((r) => r.data));
  }

  updatePlan(planId: number, value: Partial<PlanFormValue>): Observable<CatalogPlan> {
    return this.http.patch<ApiEnvelope<CatalogPlan>>(`${this.base}/plans/${planId}`, value).pipe(map((r) => r.data));
  }

  archivePlan(
    planId: number,
    reason?: string | null,
    options: { confirmAssignedChurches?: boolean } = {},
  ): Observable<unknown> {
    return this.http.post(`${this.base}/plans/${planId}/archive`, {
      reason: reason || null,
      ...(options.confirmAssignedChurches ? { confirm_assigned_churches: true } : {}),
    });
  }

  duplicatePlan(planId: number, value: { code: string; name: string; slug?: string | null }): Observable<CatalogPlan> {
    return this.http.post<ApiEnvelope<CatalogPlan>>(`${this.base}/plans/${planId}/duplicate`, value).pipe(map((r) => r.data));
  }

  restorePlan(planId: number, reason?: string | null): Observable<unknown> {
    return this.http.post(`${this.base}/plans/${planId}/restore`, { reason: reason || null });
  }

  deletePlan(planId: number, reason?: string | null): Observable<unknown> {
    return this.http.delete(`${this.base}/plans/${planId}`, { body: { reason: reason || null } });
  }

  planTenants(
    planId: number,
    filters: { versionId?: number | null; search?: string; page?: number; perPage?: number } = {},
  ): Observable<PagedEnvelope<PlanTenantRow>> {
    let params = new HttpParams();
    if (filters.versionId) params = params.set('version_id', String(filters.versionId));
    if (filters.search?.trim()) params = params.set('search', filters.search.trim());
    if (filters.page) params = params.set('page', String(filters.page));
    if (filters.perPage) params = params.set('per_page', String(filters.perPage));
    return this.http.get<PagedEnvelope<PlanTenantRow>>(`${this.base}/plans/${planId}/tenants`, { params });
  }

  matrix(): Observable<FeatureMatrix> {
    return this.http.get<ApiEnvelope<FeatureMatrix>>(`${this.base}/matrix`).pipe(map((r) => r.data));
  }

  createDraft(planId: number, fromVersionId?: number | null): Observable<PlanVersion> {
    return this.http
      .post<ApiEnvelope<PlanVersion>>(`${this.versions(planId)}`, { from_version_id: fromVersionId ?? null })
      .pipe(map((r) => r.data));
  }

  getVersion(planId: number, versionId: number): Observable<PlanVersion> {
    return this.http.get<ApiEnvelope<PlanVersion>>(`${this.versions(planId)}/${versionId}`).pipe(map((r) => r.data));
  }

  updateVersionTerms(planId: number, versionId: number, value: VersionTermsValue): Observable<PlanVersion> {
    return this.http.patch<ApiEnvelope<PlanVersion>>(`${this.versions(planId)}/${versionId}`, value).pipe(map((r) => r.data));
  }

  setEntitlements(planId: number, versionId: number, entitlements: EntitlementInput[]): Observable<PlanVersion> {
    return this.http
      .put<ApiEnvelope<PlanVersion>>(`${this.versions(planId)}/${versionId}/entitlements`, { entitlements })
      .pipe(map((r) => r.data));
  }

  deleteDraft(planId: number, versionId: number): Observable<unknown> {
    return this.http.delete(`${this.versions(planId)}/${versionId}`);
  }

  publishVersion(planId: number, versionId: number, effectiveFrom: string | null, reason?: string | null): Observable<PlanVersion> {
    return this.http
      .post<ApiEnvelope<PlanVersion>>(`${this.versions(planId)}/${versionId}/publish`, {
        effective_from: effectiveFrom || null,
        reason: reason || null,
      })
      .pipe(map((r) => r.data));
  }

  unscheduleVersion(planId: number, versionId: number, reason?: string | null): Observable<PlanVersion> {
    return this.http
      .post<ApiEnvelope<PlanVersion>>(`${this.versions(planId)}/${versionId}/unschedule`, { reason: reason || null })
      .pipe(map((r) => r.data));
  }

  retireVersion(planId: number, versionId: number, reason?: string | null): Observable<PlanVersion> {
    return this.http
      .post<ApiEnvelope<PlanVersion>>(`${this.versions(planId)}/${versionId}/retire`, { reason: reason || null })
      .pipe(map((r) => r.data));
  }

  versionImpact(planId: number, versionId: number): Observable<VersionImpact> {
    return this.http.get<ApiEnvelope<VersionImpact>>(`${this.versions(planId)}/${versionId}/impact`).pipe(map((r) => r.data));
  }

  versionPreview(planId: number, versionId: number): Observable<VersionPreview> {
    return this.http.get<ApiEnvelope<VersionPreview>>(`${this.versions(planId)}/${versionId}/preview`).pipe(map((r) => r.data));
  }

  migrateTenants(
    planId: number,
    versionId: number,
    body: {
      from_version_id?: number | null;
      limit?: number;
      keep_contracted_price?: boolean;
      confirm_impact?: boolean;
      dry_run?: boolean;
      reason: string;
    },
  ): Observable<MigrateTenantsResult> {
    return this.http
      .post<ApiEnvelope<MigrateTenantsResult>>(`${this.versions(planId)}/${versionId}/migrate-tenants`, body)
      .pipe(map((r) => r.data));
  }

  listFeatures(): Observable<CatalogFeature[]> {
    return this.http.get<ApiEnvelope<CatalogFeature[]>>(`${this.base}/features`).pipe(map((r) => r.data));
  }

  createFeature(value: FeatureFormValue): Observable<CatalogFeature> {
    return this.http.post<ApiEnvelope<CatalogFeature>>(`${this.base}/features`, value).pipe(map((r) => r.data));
  }

  updateFeature(featureId: number, value: Partial<FeatureFormValue>): Observable<CatalogFeature> {
    return this.http.patch<ApiEnvelope<CatalogFeature>>(`${this.base}/features/${featureId}`, value).pipe(map((r) => r.data));
  }

  setFeatureDependencies(featureId: number, requires: string[]): Observable<CatalogFeature> {
    return this.http
      .put<ApiEnvelope<CatalogFeature>>(`${this.base}/features/${featureId}/dependencies`, { requires })
      .pipe(map((r) => r.data));
  }

  getPolicies(): Observable<PoliciesPayload> {
    return this.http.get<ApiEnvelope<PoliciesPayload>>(`${this.base}/policies`).pipe(map((r) => r.data));
  }

  updatePolicies(value: PoliciesUpdate): Observable<PoliciesPayload> {
    return this.http.put<ApiEnvelope<PoliciesPayload>>(`${this.base}/policies`, value).pipe(map((r) => r.data));
  }

  getTaxConfiguration(): Observable<TaxConfigurationPayload> {
    return this.http.get<ApiEnvelope<TaxConfigurationPayload>>(`${this.base}/tax`).pipe(map((r) => r.data));
  }

  updateTaxConfiguration(value: TaxConfigurationUpdate): Observable<TaxConfigurationPayload> {
    return this.http.put<ApiEnvelope<TaxConfigurationPayload>>(`${this.base}/tax`, value).pipe(map((r) => r.data));
  }

  previewTax(amount: string, tax?: { rate_percent: string; prices_include_tax: boolean }): Observable<TaxPreviewBreakdown> {
    return this.http
      .post<ApiEnvelope<TaxPreviewBreakdown>>(`${this.base}/tax/preview`, { amount, ...(tax ? { tax } : {}) })
      .pipe(map((r) => r.data));
  }

  catalogAudits(
    filters: { entityType?: string | null; entityId?: number | null; page?: number; perPage?: number } = {},
  ): Observable<PagedEnvelope<CatalogAuditEntry>> {
    let params = new HttpParams();
    if (filters.entityType) params = params.set('entity_type', filters.entityType);
    if (filters.entityId) params = params.set('entity_id', String(filters.entityId));
    if (filters.page) params = params.set('page', String(filters.page));
    if (filters.perPage) params = params.set('per_page', String(filters.perPage));
    return this.http.get<PagedEnvelope<CatalogAuditEntry>>(`${this.base}/audits`, { params });
  }

  tenantSubscription(tenantId: number): Observable<AdminTenantSubscription> {
    return this.http.get<ApiEnvelope<AdminTenantSubscription>>(`${this.base}/tenants/${tenantId}`).pipe(map((r) => r.data));
  }

  previewPlanChange(tenantId: number, planId: number): Observable<PlanChangePreview> {
    return this.http
      .post<ApiEnvelope<PlanChangePreview>>(`${this.base}/tenants/${tenantId}/preview`, { plan_id: planId })
      .pipe(map((r) => r.data));
  }

  assignPlan(tenantId: number, input: AssignPlanInput): Observable<{ message?: string; data: AdminTenantSubscription }> {
    return this.http.post<{ message?: string; data: AdminTenantSubscription }>(`${this.base}/tenants/${tenantId}/assign`, input);
  }

  cancelPendingChange(tenantId: number, reason?: string | null): Observable<unknown> {
    return this.http.post(`${this.base}/tenants/${tenantId}/pending/cancel`, { reason: reason || null });
  }

  grantOverride(tenantId: number, input: GrantOverrideInput): Observable<EntitlementOverride> {
    return this.http
      .post<ApiEnvelope<EntitlementOverride>>(`${this.base}/tenants/${tenantId}/overrides`, input)
      .pipe(map((r) => r.data));
  }

  revokeOverride(tenantId: number, overrideId: number, reason?: string | null): Observable<EntitlementOverride> {
    return this.http
      .post<ApiEnvelope<EntitlementOverride>>(`${this.base}/tenants/${tenantId}/overrides/${overrideId}/revoke`, { reason: reason || null })
      .pipe(map((r) => r.data));
  }

  overview(): Observable<SubscriptionOverview> {
    return this.http.get<ApiEnvelope<SubscriptionOverview>>(`${this.base}/overview`).pipe(map((r) => r.data));
  }

  revenue(): Observable<SubscriptionRevenue> {
    return this.http.get<ApiEnvelope<SubscriptionRevenue>>(`${this.base}/revenue`).pipe(map((r) => r.data));
  }

  tenantUsage(filters: { attentionOnly?: boolean; page?: number; perPage?: number } = {}): Observable<TenantUsagePage> {
    let params = new HttpParams();
    if (filters.attentionOnly) params = params.set('attention', '1');
    if (filters.page) params = params.set('page', String(filters.page));
    if (filters.perPage) params = params.set('per_page', String(filters.perPage));
    return this.http.get<TenantUsagePage>(`${this.base}/usage`, { params });
  }

  upgradeRequests(
    filters: { status?: UpgradeRequestFilter; page?: number; perPage?: number } = {},
  ): Observable<{ data: UpgradeRequest[]; meta: PageMeta & { open_count: number } }> {
    let params = new HttpParams();
    if (filters.status) params = params.set('status', filters.status);
    if (filters.page) params = params.set('page', String(filters.page));
    if (filters.perPage) params = params.set('per_page', String(filters.perPage));
    return this.http.get<{ data: UpgradeRequest[]; meta: PageMeta & { open_count: number } }>(`${this.base}/upgrade-requests`, {
      params,
    });
  }

  approveUpgradeRequest(requestId: number, input: ApproveUpgradeInput): Observable<UpgradeRequest> {
    return this.http
      .post<ApiEnvelope<UpgradeRequest>>(`${this.base}/upgrade-requests/${requestId}/approve`, input)
      .pipe(map((r) => r.data));
  }

  rejectUpgradeRequest(requestId: number, note: string): Observable<UpgradeRequest> {
    return this.http
      .post<ApiEnvelope<UpgradeRequest>>(`${this.base}/upgrade-requests/${requestId}/reject`, { note })
      .pipe(map((r) => r.data));
  }

  requestUpgradeInfo(requestId: number, note: string): Observable<UpgradeRequest> {
    return this.http
      .post<ApiEnvelope<UpgradeRequest>>(`${this.base}/upgrade-requests/${requestId}/request-info`, { note })
      .pipe(map((r) => r.data));
  }

  private versions(planId: number): string {
    return `${this.base}/plans/${planId}/versions`;
  }
}

/** Plain-language message from a subscription API error (never raw server internals). */
/**
 * Normalises both a raw HttpErrorResponse and the flattened `{ status, message, code, errors }`
 * object that the app-wide error interceptor re-throws.
 */
function readSubscriptionError(error: unknown): { status: number; body: SubscriptionApiError } | null {
  if (error instanceof HttpErrorResponse) {
    return { status: error.status, body: (error.error ?? {}) as SubscriptionApiError };
  }
  if (error && typeof error === 'object' && typeof (error as { status?: unknown }).status === 'number') {
    const e = error as { status: number } & SubscriptionApiError;
    return { status: e.status, body: { code: e.code, message: e.message, errors: e.errors } };
  }
  return null;
}

export function subscriptionErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const parsed = readSubscriptionError(error);
  if (!parsed) return fallback;
  const { status, body } = parsed;
  const firstField = body.errors ? Object.values(body.errors)[0]?.[0] : undefined;
  if (status === 422 && firstField) return firstField;
  if (typeof body.message === 'string' && body.message.trim() !== '' && status > 0 && status < 500) return body.message;
  if (status === 403) return 'You do not have permission to do this.';
  if (status === 404) return 'This item no longer exists.';
  return fallback;
}

export function subscriptionErrorCode(error: unknown): string | null {
  const code = readSubscriptionError(error)?.body.code;
  return typeof code === 'string' ? code : null;
}
