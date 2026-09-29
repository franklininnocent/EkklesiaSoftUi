import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Observable, Subject, filter, forkJoin, map, of, switchMap, takeUntil } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ConfirmationDialogService } from '@core/services/confirmation-dialog.service';
import { ToastService } from '@core/services/toast.service';
import { ActionBarComponent, ActionBarItem } from '@shared/components/action-bar/action-bar.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { StatusBadgeComponent, StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';
import { TabStripComponent, TabStripItem } from '@shared/components/tab-strip/tab-strip.component';
import { CfCurrencyPipe } from '@shared/pipes/cf-currency.pipe';
import {
  BillingInterval,
  CatalogFeature,
  CatalogPlan,
  PlanFormValue,
  PlanVersion,
  PlanVersionStatus,
  PricingType,
  VersionTermsValue,
} from '../../models/subscription-admin.models';
import { SubscriptionAdminService, subscriptionErrorCode, subscriptionErrorMessage } from '../../services/subscription-admin.service';
import { subscriptionAdminCapabilities } from '../../services/subscription-admin-access';
import { EntitlementsEditorComponent } from '../../components/entitlements-editor/entitlements-editor.component';
import { MigrateTenantsDialogComponent } from '../../components/migrate-tenants-dialog/migrate-tenants-dialog.component';
import { PlanTenantsPanelComponent } from '../../components/plan-tenants-panel/plan-tenants-panel.component';
import { VersionReviewDialogComponent } from '../../components/version-review-dialog/version-review-dialog.component';
import { isSubscriptionAdminLayoutV2 } from '../../config/subscription-admin-layout.config';

type EditorTab = 'details' | 'versions' | 'pricing' | 'features' | 'churches';

const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;
const PERCENT_PATTERN = /^\d{1,3}(\.\d{1,2})?$/;
const EDITOR_TABS: EditorTab[] = ['details', 'versions', 'pricing', 'features', 'churches'];

interface TermsForm {
  currency_code: string;
  monthly_price: string;
  annual_price: string;
  setup_fee: string;
  tax_mode: 'inherit' | 'override';
  tax_inclusive: boolean;
  tax_rate_percent: string;
  tax_label: string;
  trial_days: number | null;
  intervals: Record<BillingInterval, boolean>;
  change_notes: string;
}

@Component({
  selector: 'app-plan-editor-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    ActionBarComponent,
    DataTableComponent,
    LoadingSkeletonComponent,
    StatusBadgeComponent,
    TabStripComponent,
    CfCurrencyPipe,
    EntitlementsEditorComponent,
    MigrateTenantsDialogComponent,
    PlanTenantsPanelComponent,
    VersionReviewDialogComponent,
  ],
  templateUrl: './plan-editor.page.html',
  styleUrls: ['../../styles/subscription-admin.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanEditorPage implements OnInit, OnDestroy {
  private readonly api = inject(SubscriptionAdminService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmationDialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  readonly can = subscriptionAdminCapabilities(this.auth);
  readonly isLayoutV2 = isSubscriptionAdminLayoutV2();
  readonly pricingTypes: { value: PricingType; label: string }[] = [
    { value: 'FIXED', label: 'Fixed price' },
    { value: 'CUSTOM', label: 'Custom (quoted per church)' },
    { value: 'FREE', label: 'Free' },
  ];
  readonly intervalOptions: { value: BillingInterval; label: string }[] = [
    { value: 'MONTHLY', label: 'Monthly' },
    { value: 'ANNUAL', label: 'Yearly' },
    { value: 'CUSTOM', label: 'Custom term' },
  ];

  planId = 0;
  plan: CatalogPlan | null = null;
  features: CatalogFeature[] = [];
  loading = true;
  error: string | null = null;
  private requestedTab: EditorTab | null = null;

  activeTab: EditorTab = 'versions';
  selectedVersionId: number | null = null;

  detailsForm: PlanFormValue = { name: '', pricing_type: 'FIXED' };
  detailsSaving = false;
  termsForm: TermsForm = this.emptyTerms();
  termsSaving = false;
  termsDirty = false;
  entitlementsDirty = false;
  busyVersionId: number | null = null;

  reviewVersion: PlanVersion | null = null;
  reviewMode: 'preview' | 'publish' = 'preview';
  migrateFrom: PlanVersion | null = null;

  get tabs(): TabStripItem[] {
    const compact = this.isLayoutV2;
    const tabs: TabStripItem[] = [
      { id: 'versions', label: 'Versions' },
      { id: 'pricing', label: compact ? 'Pricing' : 'Pricing & trial' },
      { id: 'features', label: compact ? 'Features' : 'Features & limits' },
      { id: 'details', label: compact ? 'Details' : 'Plan details' },
    ];
    if (this.can.usage) {
      tabs.push({
        id: 'churches',
        label: compact ? `Churches (${this.plan?.tenant_count ?? 0})` : `Churches (${this.plan?.tenant_count ?? 0})`,
      });
    }
    return tabs.map((t) => ({ ...t, domId: `sa-editor-tab-${t.id}`, ariaControls: `sa-editor-panel-${t.id}` }));
  }

  get versions(): PlanVersion[] {
    return [...(this.plan?.versions ?? [])].sort((a, b) => b.version_number - a.version_number);
  }

  get selectedVersion(): PlanVersion | null {
    return this.versions.find((v) => v.id === this.selectedVersionId) ?? null;
  }

  get activeVersion(): PlanVersion | null {
    return this.versions.find((v) => v.status === 'ACTIVE') ?? null;
  }

  get draftVersion(): PlanVersion | null {
    return this.versions.find((v) => v.status === 'DRAFT') ?? null;
  }

  /** In-place plan header edits (blocked when churches are assigned). */
  get canEditDetails(): boolean {
    return this.can.manage && !!this.plan && this.plan.is_editable === true;
  }

  /** Draft versions, pricing, features — still allowed for assigned plans. */
  get canManageVersions(): boolean {
    return this.can.manage && !!this.plan && !this.plan.is_legacy;
  }

  /** @deprecated Prefer canEditDetails / canManageVersions. Kept for template clarity. */
  get canEditPlan(): boolean {
    return this.canManageVersions;
  }

  get canChangePricingType(): boolean {
    return this.canEditDetails && !!this.plan && this.versions.every((v) => v.status === 'DRAFT');
  }

  get versionReadonly(): boolean {
    return !this.canManageVersions || !this.selectedVersion?.is_editable;
  }

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((q) => {
      const tab = q.get('tab');
      this.requestedTab = tab && (EDITOR_TABS as string[]).includes(tab) ? (tab as EditorTab) : null;
    });
    this.route.paramMap
      .pipe(
        map((p) => Number(p.get('planId'))),
        takeUntil(this.destroy$),
      )
      .subscribe((id) => {
        this.planId = Number.isInteger(id) && id > 0 ? id : 0;
        this.load(true);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(initial = false): void {
    if (!this.planId) {
      this.error = 'This plan does not exist.';
      this.loading = false;
      this.cdr.markForCheck();
      return;
    }
    this.loading = initial || !this.plan;
    this.error = null;
    this.cdr.markForCheck();
    const features$: Observable<CatalogFeature[]> = this.features.length ? of(this.features) : this.api.listFeatures();
    forkJoin({ plan: this.api.getPlan(this.planId), features: features$ })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ plan, features }) => {
          this.features = features;
          this.applyPlan(plan, initial);
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = subscriptionErrorMessage(err, 'Unable to load this plan.');
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  onTabChange(id: string): void {
    this.activeTab = id as EditorTab;
    this.cdr.markForCheck();
  }

  selectVersion(version: PlanVersion, tab?: EditorTab): void {
    const switching = version.id !== this.selectedVersionId;
    const proceed = () => {
      this.selectedVersionId = version.id;
      if (switching) this.resetTerms();
      if (tab) this.activeTab = tab;
      this.cdr.markForCheck();
    };
    if (switching && (this.termsDirty || this.entitlementsDirty)) {
      this.confirm
        .confirm({
          title: 'Discard unsaved changes?',
          message: 'You have unsaved changes on the current version.',
          confirmText: 'Discard',
          variant: 'danger',
        })
        .pipe(filter((r) => r.confirmed), takeUntil(this.destroy$))
        .subscribe(() => {
          this.entitlementsDirty = false;
          proceed();
        });
      return;
    }
    proceed();
  }

  onSelectVersionId(id: number): void {
    const version = this.versions.find((v) => v.id === Number(id));
    if (version) this.selectVersion(version);
  }

  statusTone(status: PlanVersionStatus): StatusBadgeTone {
    return status === 'ACTIVE' ? 'success' : status === 'SCHEDULED' ? 'info' : status === 'DRAFT' ? 'warning' : 'neutral';
  }

  statusLabel(status: PlanVersionStatus): string {
    return { ACTIVE: 'Live', SCHEDULED: 'Scheduled', DRAFT: 'Draft', RETIRED: 'Retired' }[status];
  }

  // ----- Plan details --------------------------------------------------------------------

  saveDetails(): void {
    if (!this.plan || !this.canEditDetails || this.detailsSaving) return;
    const name = (this.detailsForm.name || '').trim();
    if (name.length < 2) {
      this.toast.error('Enter a plan name.', 'Check your entries');
      return;
    }
    const payload = this.buildDetailsPayload(name);
    if (this.detailsNeedAssignmentConfirm(payload)) {
      const reasons = this.restrictedDetailReasons(payload);
      const body = reasons.length
        ? reasons.map((r) => r.reason).join(' ')
        : 'This change affects how the plan is offered. Churches already on this plan keep their current version.';
      this.confirm
        .confirm({
          title: 'Confirm plan change',
          message: body,
          confirmText: 'Save changes',
          variant: 'danger',
        })
        .pipe(
          filter((r) => r.confirmed),
          takeUntil(this.destroy$),
        )
        .subscribe(() => this.submitDetails(payload, true));
      return;
    }
    this.submitDetails(payload, false);
  }

  private buildDetailsPayload(name: string): Partial<PlanFormValue> {
    const order = this.detailsForm.display_order;
    const payload: Partial<PlanFormValue> = {
      name,
      short_description: this.detailsForm.short_description?.trim() || null,
      description: this.detailsForm.description?.trim() || null,
      badge_label: this.detailsForm.badge_label?.trim() || null,
      is_public: !!this.detailsForm.is_public,
      is_featured: !!this.detailsForm.is_featured,
      is_assignable: !!this.detailsForm.is_assignable,
      ...(order !== null && order !== undefined && `${order}` !== '' ? { display_order: Number(order) } : {}),
    };
    if (this.canChangePricingType && this.detailsForm.pricing_type) {
      payload.pricing_type = this.detailsForm.pricing_type;
    }
    return payload;
  }

  private detailsNeedAssignmentConfirm(payload: Partial<PlanFormValue>): boolean {
    if (!this.plan || this.plan.tenant_count <= 0) return false;
    return this.restrictedDetailReasons(payload).length > 0;
  }

  private restrictedDetailReasons(payload: Partial<PlanFormValue>): { field: string; reason: string }[] {
    if (!this.plan) return [];
    const reasons: { field: string; reason: string }[] = [];
    const policy = this.plan.edit_policy;
    const byField = new Map((policy?.restricted_fields ?? []).map((f) => [f.field, f.reason]));

    if (payload.is_public === false && this.plan.is_public) {
      const reason = byField.get('is_public');
      if (reason) reasons.push({ field: 'is_public', reason });
    }
    if (payload.is_assignable === false && this.plan.is_assignable) {
      const reason = byField.get('is_assignable');
      if (reason) reasons.push({ field: 'is_assignable', reason });
    }
    if (
      payload.display_order !== undefined &&
      payload.display_order !== null &&
      Number(payload.display_order) !== Number(this.plan.display_order)
    ) {
      const reason = byField.get('display_order');
      if (reason) reasons.push({ field: 'display_order', reason });
    }

    return reasons;
  }

  private submitDetails(payload: Partial<PlanFormValue>, confirmAssignmentImpact: boolean): void {
    if (!this.plan || this.detailsSaving) return;
    this.detailsSaving = true;
    this.cdr.markForCheck();
    const body: Partial<PlanFormValue> = {
      ...payload,
      ...(confirmAssignmentImpact ? { confirm_assignment_impact: true } : {}),
    };
    this.api
      .updatePlan(this.plan.id, body)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (plan) => {
          this.detailsSaving = false;
          this.toast.success('Plan details saved.', 'Saved');
          this.applyPlan(plan, false);
          this.cdr.markForCheck();
        },
        error: (err) => {
          const code = subscriptionErrorCode(err);
          if (code === 'PLAN_EDIT_REQUIRES_CONFIRMATION') {
            this.detailsSaving = false;
            this.confirm
              .confirm({
                title: 'Confirm plan change',
                message: subscriptionErrorMessage(
                  err,
                  'Another church was linked to this plan. Confirm to save your changes.',
                ),
                confirmText: 'Save changes',
                variant: 'danger',
              })
              .pipe(filter((r) => r.confirmed), takeUntil(this.destroy$))
              .subscribe(() => this.submitDetails(payload, true));
            return;
          }
          this.detailsSaving = false;
          this.toast.error(subscriptionErrorMessage(err, 'Unable to save plan details.'), 'Not saved');
          this.cdr.markForCheck();
        },
      });
  }

  // ----- Pricing & trial -----------------------------------------------------------------

  saveTerms(): void {
    const version = this.selectedVersion;
    if (!this.plan || !version || this.versionReadonly || this.termsSaving) return;
    const f = this.termsForm;
    const money = (label: string, v: string): string | null | false => {
      const trimmed = (v ?? '').toString().trim();
      if (trimmed === '') return null;
      if (!MONEY_PATTERN.test(trimmed)) {
        this.toast.error(`${label}: use numbers only, up to 2 decimals.`, 'Check your entries');
        return false;
      }
      return trimmed;
    };
    const monthly = money('Monthly price', f.monthly_price);
    const annual = money('Yearly price', f.annual_price);
    const setup = money('Setup fee', f.setup_fee);
    if (monthly === false || annual === false || setup === false) return;
    let tax: string | null = null;
    let taxLabel: string | null = null;
    if (f.tax_mode === 'override') {
      tax = f.tax_rate_percent.trim();
      if (tax === '' || !PERCENT_PATTERN.test(tax) || Number(tax) > 100) {
        this.toast.error('Tax rate must be between 0 and 100.', 'Check your entries');
        return;
      }
      taxLabel = f.tax_label.trim() || null;
    }
    const intervals = this.intervalOptions.filter((o) => f.intervals[o.value]).map((o) => o.value);
    if (!intervals.length) {
      this.toast.error('Choose at least one billing option.', 'Check your entries');
      return;
    }
    const trial = f.trial_days === null || `${f.trial_days}` === '' ? null : Number(f.trial_days);
    if (trial !== null && (!Number.isInteger(trial) || trial < 0 || trial > 365)) {
      this.toast.error('Trial days must be a whole number from 0 to 365.', 'Check your entries');
      return;
    }
    const currency = f.currency_code.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      this.toast.error('Currency must be a 3-letter code.', 'Check your entries');
      return;
    }

    const payload: VersionTermsValue = {
      currency_code: currency,
      monthly_price: monthly,
      annual_price: annual,
      setup_fee: setup,
      tax_inclusive: f.tax_mode === 'override' ? f.tax_inclusive : false,
      tax_rate_percent: tax,
      tax_label: taxLabel,
      trial_days: trial,
      billing_intervals: intervals,
      change_notes: f.change_notes.trim() || null,
    };
    this.termsSaving = true;
    this.cdr.markForCheck();
    this.api
      .updateVersionTerms(this.plan.id, version.id, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          this.termsSaving = false;
          this.termsDirty = false;
          this.replaceVersion(updated);
          this.resetTerms();
          this.toast.success('Pricing and trial saved.', 'Saved');
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.termsSaving = false;
          this.toast.error(subscriptionErrorMessage(err, 'Unable to save pricing.'), 'Not saved');
          this.cdr.markForCheck();
        },
      });
  }

  effectiveTaxSummary(): string {
    const t = this.selectedVersion?.effective_tax;
    if (!t) return '';
    const treatment = t.prices_include_tax ? 'Inclusive' : 'Exclusive';
    return `${t.label} · ${Number(t.rate_percent)}% · ${treatment}`;
  }

  resetTerms(): void {
    this.termsForm = this.termsFrom(this.selectedVersion);
    this.termsDirty = false;
    this.cdr.markForCheck();
  }

  onEntitlementsSaved(version: PlanVersion): void {
    this.replaceVersion(version);
    this.cdr.markForCheck();
  }

  // ----- Version lifecycle ---------------------------------------------------------------

  startDraft(): void {
    if (!this.plan || !this.canEditPlan) return;
    const from = this.activeVersion ?? this.versions[0] ?? null;
    this.busyVersionId = -1;
    this.cdr.markForCheck();
    this.api
      .createDraft(this.plan.id, from?.id ?? null)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (draft) => {
          this.busyVersionId = null;
          this.toast.success(`Draft version ${draft.version_number} created${from ? ` from version ${from.version_number}` : ''}.`, 'Draft ready');
          this.selectedVersionId = draft.id;
          this.activeTab = 'pricing';
          this.load();
        },
        error: (err) => {
          this.busyVersionId = null;
          this.toast.error(subscriptionErrorMessage(err, 'Unable to start a draft.'), 'Not created');
          this.cdr.markForCheck();
        },
      });
  }

  openReview(version: PlanVersion, mode: 'preview' | 'publish'): void {
    if (mode === 'publish' && (this.termsDirty || this.entitlementsDirty) && version.id === this.selectedVersionId) {
      this.toast.warning('Save or discard your changes before publishing.', 'Unsaved changes');
      return;
    }
    this.reviewVersion = version;
    this.reviewMode = mode;
    this.cdr.markForCheck();
  }

  closeReview(): void {
    this.reviewVersion = null;
    this.cdr.markForCheck();
  }

  onPublished(version: PlanVersion): void {
    this.reviewVersion = null;
    this.selectedVersionId = version.id;
    this.load();
  }

  deletePlan(): void {
    const plan = this.plan;
    if (!plan || !plan.can_delete) return;
    this.confirm
      .confirm({
        title: `Delete ${plan.name}?`,
        message:
          'This permanently removes the plan from the catalog. Churches already on other plans are not changed. This cannot be undone from this screen.',
        confirmText: 'Delete plan',
        variant: 'danger',
        showDescriptionInput: true,
        descriptionLabel: 'Reason (kept in change history)',
      })
      .pipe(
        filter((r) => r.confirmed),
        switchMap((r) => this.api.deletePlan(plan.id, r.description)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => {
          this.toast.success(`${plan.name} deleted.`, 'Deleted');
          void this.router.navigate(['/settings/subscription/plans']);
        },
        error: (err) => this.toast.error(subscriptionErrorMessage(err, 'Unable to delete the plan.'), 'Not deleted'),
      });
  }

  deleteDraft(version: PlanVersion): void {
    if (!this.plan) return;
    const planId = this.plan.id;
    this.confirm
      .confirm({
        title: `Delete draft version ${version.version_number}?`,
        message: 'Only this unpublished draft is removed. Live versions and churches are not affected.',
        confirmText: 'Delete draft',
        variant: 'danger',
      })
      .pipe(
        filter((r) => r.confirmed),
        switchMap(() => this.runVersionAction(version, this.api.deleteDraft(planId, version.id))),
        takeUntil(this.destroy$),
      )
      .subscribe((ok) => {
        if (!ok) return;
        this.toast.success('Draft deleted.', 'Deleted');
        if (this.selectedVersionId === version.id) this.selectedVersionId = null;
        this.load();
      });
  }

  unschedule(version: PlanVersion): void {
    this.reasonAction(version, {
      title: `Cancel the schedule for version ${version.version_number}?`,
      message: 'The version goes back to draft so you can edit it. Nothing changes for churches.',
      confirmText: 'Cancel schedule',
      success: 'Schedule cancelled; the version is a draft again.',
      run: (planId, reason) => this.api.unscheduleVersion(planId, version.id, reason),
    });
  }

  retire(version: PlanVersion): void {
    this.reasonAction(version, {
      title: `Retire version ${version.version_number}?`,
      message:
        'New churches can no longer be given this plan until another version is published. Churches already on it keep their features and data.',
      confirmText: 'Retire version',
      danger: true,
      success: `Version ${version.version_number} retired.`,
      run: (planId, reason) => this.api.retireVersion(planId, version.id, reason),
    });
  }

  openMigrate(version: PlanVersion): void {
    this.migrateFrom = version;
    this.cdr.markForCheck();
  }

  closeMigrate(): void {
    this.migrateFrom = null;
    this.cdr.markForCheck();
  }

  versionRowActions(version: PlanVersion): ActionBarItem[] {
    const actions: ActionBarItem[] = [];

    if (version.is_editable && this.canManageVersions) {
      actions.push({ id: 'edit', label: 'Edit', tier: 'secondary', icon: 'edit' });
    } else {
      actions.push({ id: 'view', label: 'View', tier: 'secondary', icon: 'view' });
    }

    actions.push({ id: 'preview', label: 'Preview', tier: 'ghost', icon: 'preview' });

    if (version.status === 'DRAFT' && this.can.publish) {
      actions.push({ id: 'publish', label: 'Publish', tier: 'primary', icon: 'publish' });
    }

    if (version.status === 'DRAFT' && this.canManageVersions && !(version.tenant_count)) {
      actions.push({
        id: 'delete-draft',
        label: 'Delete draft',
        tier: 'danger',
        icon: 'delete',
        disabled: this.busyVersionId === version.id,
      });
    }

    if (version.status === 'SCHEDULED' && this.can.publish) {
      actions.push({
        id: 'unschedule',
        label: 'Cancel schedule',
        tier: 'secondary',
        icon: 'cancel',
        disabled: this.busyVersionId === version.id,
      });
    }

    if (version.status === 'ACTIVE' && this.can.publish && !this.plan?.is_legacy) {
      actions.push({
        id: 'retire',
        label: 'Retire',
        tier: 'danger',
        icon: 'retire',
        disabled: this.busyVersionId === version.id,
      });
    }

    if (this.can.tenants && this.activeVersion && version.id !== this.activeVersion.id && (version.tenant_count ?? 0) > 0) {
      actions.push({
        id: 'migrate',
        label: `Move to v${this.activeVersion.version_number}`,
        tier: 'secondary',
        icon: 'migrate',
      });
    }

    return actions;
  }

  onVersionRowAction(actionId: string, version: PlanVersion): void {
    switch (actionId) {
      case 'edit':
        this.selectVersion(version, 'pricing');
        break;
      case 'view':
        this.selectVersion(version, 'features');
        break;
      case 'preview':
        this.openReview(version, 'preview');
        break;
      case 'publish':
        this.openReview(version, 'publish');
        break;
      case 'delete-draft':
        this.deleteDraft(version);
        break;
      case 'unschedule':
        this.unschedule(version);
        break;
      case 'retire':
        this.retire(version);
        break;
      case 'migrate':
        this.openMigrate(version);
        break;
    }
  }

  // ----- helpers -------------------------------------------------------------------------

  private reasonAction(
    version: PlanVersion,
    opts: {
      title: string;
      message: string;
      confirmText: string;
      success: string;
      danger?: boolean;
      run: (planId: number, reason: string | null) => Observable<unknown>;
    },
  ): void {
    if (!this.plan) return;
    const planId = this.plan.id;
    this.confirm
      .confirm({
        title: opts.title,
        message: opts.message,
        confirmText: opts.confirmText,
        variant: opts.danger ? 'danger' : 'primary',
        showDescriptionInput: true,
        descriptionLabel: 'Reason (kept in change history)',
      })
      .pipe(
        filter((r) => r.confirmed),
        switchMap((r) => this.runVersionAction(version, opts.run(planId, r.description?.trim() || null))),
        takeUntil(this.destroy$),
      )
      .subscribe((ok) => {
        if (!ok) return;
        this.toast.success(opts.success, 'Done');
        this.load();
      });
  }

  private runVersionAction(version: PlanVersion, action$: Observable<unknown>): Observable<boolean> {
    this.busyVersionId = version.id;
    this.cdr.markForCheck();
    return new Observable<boolean>((subscriber) => {
      const sub = action$.subscribe({
        next: () => {
          this.busyVersionId = null;
          subscriber.next(true);
          subscriber.complete();
        },
        error: (err) => {
          this.busyVersionId = null;
          this.toast.error(subscriptionErrorMessage(err, 'That did not work. Please try again.'), 'Not completed');
          this.cdr.markForCheck();
          subscriber.next(false);
          subscriber.complete();
        },
      });
      return () => sub.unsubscribe();
    });
  }

  private applyPlan(plan: CatalogPlan, initial: boolean): void {
    this.plan = plan;
    this.detailsForm = {
      name: plan.name,
      short_description: plan.short_description,
      description: plan.description,
      badge_label: plan.badge_label,
      pricing_type: plan.pricing_type,
      is_public: plan.is_public,
      is_featured: plan.is_featured,
      is_assignable: plan.is_assignable,
      display_order: plan.display_order,
    };
    const versions = this.versions;
    if (!versions.some((v) => v.id === this.selectedVersionId)) {
      const preferred =
        versions.find((v) => v.status === 'DRAFT') ??
        versions.find((v) => v.status === 'SCHEDULED') ??
        versions.find((v) => v.status === 'ACTIVE') ??
        versions[0] ??
        null;
      this.selectedVersionId = preferred?.id ?? null;
    }
    this.termsForm = this.termsFrom(this.selectedVersion);
    this.termsDirty = false;
    if (initial) {
      if (!this.activeVersion && this.draftVersion) this.activeTab = 'pricing';
      // Apply after the draft-pricing default so Edit Plan (?tab=details) wins.
      if (this.requestedTab && (this.requestedTab !== 'churches' || this.can.usage)) {
        this.activeTab = this.requestedTab;
      }
    }
  }

  private replaceVersion(updated: PlanVersion): void {
    if (!this.plan?.versions) return;
    this.plan = {
      ...this.plan,
      versions: this.plan.versions.map((v) => (v.id === updated.id ? { ...v, ...updated, tenant_count: v.tenant_count } : v)),
    };
  }

  private emptyTerms(): TermsForm {
    return {
      currency_code: '',
      monthly_price: '',
      annual_price: '',
      setup_fee: '',
      tax_mode: 'inherit',
      tax_inclusive: false,
      tax_rate_percent: '',
      tax_label: '',
      trial_days: null,
      intervals: { MONTHLY: true, ANNUAL: true, CUSTOM: false },
      change_notes: '',
    };
  }

  private termsFrom(v: PlanVersion | null): TermsForm {
    if (!v) return this.emptyTerms();
    const intervals = new Set(v.billing_intervals ?? []);
    return {
      currency_code: v.currency_code ?? '',
      monthly_price: v.monthly_price ?? '',
      annual_price: v.annual_price ?? '',
      setup_fee: v.setup_fee ?? '',
      tax_mode: v.tax_rate_percent !== null && v.tax_rate_percent !== '' ? 'override' : 'inherit',
      tax_inclusive: v.tax_inclusive,
      tax_rate_percent: v.tax_rate_percent ?? '',
      tax_label: v.tax_label ?? '',
      trial_days: v.trial_days,
      intervals: { MONTHLY: intervals.has('MONTHLY'), ANNUAL: intervals.has('ANNUAL'), CUSTOM: intervals.has('CUSTOM') },
      change_notes: v.change_notes ?? '',
    };
  }
}
