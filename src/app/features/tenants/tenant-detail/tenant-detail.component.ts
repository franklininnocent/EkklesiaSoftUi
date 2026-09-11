/**
 * Platform-admin 360° Tenant Details & Management
 */

import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TenantService } from '@core/services/tenant.service';
import { ToastService } from '@core/services/toast.service';
import { Tenant, TenantDetailsSnapshot, TenantDetailsUserPreview } from '@core/models/tenant.model';
import { UserAvatarComponent, ImageViewerComponent } from '@shared/components';
import { resolveUserProfileImageUrl } from '@core/utils/user-profile-image.util';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { StatusBadgeComponent, StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';
import { TabStripComponent, TabStripItem } from '@shared/components/tab-strip/tab-strip.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { Subject, takeUntil } from 'rxjs';
import { environment } from '@environments/environment';

const PLAN_RANK_LADDER = ['free', 'basic', 'premium', 'enterprise'] as const;

type TenantDetailTab =
  | 'overview'
  | 'subscription'
  | 'modules'
  | 'users'
  | 'church'
  | 'security'
  | 'history'
  | 'technical';

@Component({
  selector: 'app-tenant-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageHeaderComponent,
    StatusBadgeComponent,
    TabStripComponent,
    ModalShellComponent,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
    DataTableComponent,
    UserAvatarComponent,
    ImageViewerComponent,
  ],
  templateUrl: './tenant-detail.component.html',
  styleUrls: ['./tenant-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TenantDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private tenantService = inject(TenantService);
  private toastService = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  details: TenantDetailsSnapshot | null = null;
  photoViewer: { src: string; alt: string; title: string; subtitle: string } | null = null;
  /** Minimal tenant shim for subscription modals and legacy edit flows. */
  tenant: Tenant | null = null;
  loading = false;
  error: string | null = null;
  tenantId: number | null = null;

  activeTab: TenantDetailTab = 'overview';
  readonly tabs: TabStripItem[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'subscription', label: 'Subscription' },
    { id: 'modules', label: 'Modules' },
    { id: 'users', label: 'Users' },
    { id: 'church', label: 'Church' },
    { id: 'security', label: 'Security' },
    { id: 'history', label: 'History' },
    { id: 'technical', label: 'Technical' },
  ];

  isEditing = false;
  editForm: Partial<Tenant> = {};
  logoFile: File | null = null;
  logoPreview: string | null = null;

  availablePlans: Record<string, any> = {};
  currency = 'INR';
  durationOptions: Array<{ value: number; label: string }> = [];
  selectedPlan = '';
  subscriptionDuration = 12;
  showUpgradeModal = false;
  showRenewModal = false;
  showSuspendModal = false;
  showReactivateModal = false;
  subscriptionReason = '';
  subscriptionActionSaving = false;
  plansLoading = false;
  plansLoadError: string | null = null;

  subscriptionAudits: Array<{
    id: number;
    operation: string;
    operation_label: string;
    source: string;
    reason: string | null;
    actor_name: string | null;
    actor_role: string | null;
    summary: string;
    before_state: Record<string, unknown>;
    after_state: Record<string, unknown>;
    created_at: string | null;
  }> = [];
  auditOperations: Record<string, string> = {};
  auditFilterOperation = '';
  auditsLoading = false;
  auditsError: string | null = null;
  auditsPage = 1;
  auditsLastPage = 1;
  auditsTotal = 0;
  expandedAuditId: number | null = null;

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.tenantId = +params['id'];
      if (this.tenantId) {
        this.loadDetails();
        this.loadSubscriptionPlans();
        if (this.activeTab === 'subscription' || this.activeTab === 'history') {
          this.loadSubscriptionAudits(true);
        }
      }
    });

    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(queryParams => {
      const tab = this.normalizeTab(queryParams['tab']);
      if (tab) {
        this.setActiveTab(tab);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDetails(): void {
    if (!this.tenantId) return;

    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.tenantService.getTenantDetails(this.tenantId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.details = response.data;
            this.syncTenantShim(response.data);
            this.editForm = { ...this.tenant };
          } else {
            this.error = response.message || 'Failed to load tenant details';
          }
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          const status = err?.status ?? err?.error?.status;
          if (status === 404) {
            this.error = 'Tenant details could not be loaded. The details API may be missing — ensure the backend is updated and try again.';
          } else if (status === 403) {
            this.error = 'You do not have permission to view this tenant.';
          } else {
            this.error = err.error?.message || err.message || 'Failed to load tenant details';
          }
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  private syncTenantShim(snapshot: TenantDetailsSnapshot): void {
    const sub = snapshot.subscription;
    this.tenant = {
      id: snapshot.identity.id,
      name: snapshot.identity.name,
      slogan: snapshot.identity.slogan ?? null,
      slug: snapshot.identity.slug,
      domain: snapshot.identity.domain ?? null,
      plan: (sub.plan_key as Tenant['plan']) || 'free',
      max_users: sub.max_users ?? snapshot.administration.max_users,
      max_storage_mb: sub.max_storage_mb ?? 0,
      trial_ends_at: sub.trial_ends_at ?? null,
      subscription_ends_at: sub.subscription_ends_at ?? null,
      subscription_suspended_at: sub.subscription_suspended_at ?? null,
      subscription_status: sub.status ?? null,
      access_mode: sub.access_mode ?? null,
      active: snapshot.operational.active_flag,
      features: sub.features ?? snapshot.meta.features ?? null,
      logo_url: snapshot.identity.logo_url ?? null,
      logo_full_url: snapshot.identity.logo_full_url ?? null,
      primary_color: snapshot.identity.primary_color ?? '#000000',
      secondary_color: snapshot.identity.secondary_color ?? '#ffffff',
      created_at: snapshot.identity.created_at ?? '',
      updated_at: snapshot.identity.updated_at ?? '',
    };
  }

  setActiveTab(tab: TenantDetailTab): void {
    this.activeTab = tab;
    if (tab === 'subscription' || tab === 'history') {
      this.loadSubscriptionAudits(true);
    }
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.cdr.markForCheck();
  }

  onTabChange(tabId: string): void {
    if (this.isValidTab(tabId)) {
      this.setActiveTab(tabId as TenantDetailTab);
    }
  }

  private isValidTab(tab: string): boolean {
    return this.tabs.some(t => t.id === tab);
  }

  /** Map legacy ?tab= values from the pre-360 page to current tabs. */
  private normalizeTab(tab: string | undefined): TenantDetailTab | null {
    if (!tab) {
      return null;
    }
    const legacy: Record<string, TenantDetailTab> = {
      details: 'overview',
      actions: 'overview',
    };
    const resolved = legacy[tab] ?? tab;
    return this.isValidTab(resolved) ? (resolved as TenantDetailTab) : null;
  }

  loadSubscriptionAudits(resetPage = false): void {
    if (!this.tenantId) return;
    if (resetPage) this.auditsPage = 1;

    this.auditsLoading = true;
    this.auditsError = null;
    this.cdr.markForCheck();

    this.tenantService.getSubscriptionAudits(this.tenantId, {
      page: this.auditsPage,
      per_page: 10,
      operation: this.auditFilterOperation || null,
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response.success && Array.isArray(response.data)) {
          this.subscriptionAudits = response.data;
          this.auditsPage = response.pagination?.current_page || 1;
          this.auditsLastPage = response.pagination?.last_page || 1;
          this.auditsTotal = response.pagination?.total || 0;
          if (response.meta?.operations) {
            this.auditOperations = response.meta.operations;
          }
        } else {
          this.auditsError = response.message || 'Unable to load subscription history.';
          this.subscriptionAudits = [];
        }
        this.auditsLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.auditsError = err?.message || err?.error?.message || 'Unable to load subscription history.';
        this.subscriptionAudits = [];
        this.auditsLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  toggleEdit(): void {
    this.isEditing = !this.isEditing;
    if (this.isEditing && this.tenant) {
      this.editForm = { ...this.tenant };
    }
    this.cdr.markForCheck();
  }

  saveTenant(): void {
    if (!this.tenantId || !this.tenant) return;

    this.loading = true;
    this.cdr.markForCheck();

    this.tenantService.updateTenant(this.tenantId, this.editForm as any)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.isEditing = false;
            this.toastService.success('Tenant updated successfully', 'Success');
            this.loadDetails();
          } else {
            this.toastService.error(response.message || 'Failed to update tenant', 'Error');
          }
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.toastService.error(err.error?.message || 'Failed to update tenant', 'Error');
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  cancelEdit(): void {
    this.isEditing = false;
    if (this.tenant) this.editForm = { ...this.tenant };
    this.cdr.markForCheck();
  }

  toggleTenantStatus(): void {
    if (!this.tenantId || !this.details) return;

    const newStatus: 0 | 1 = this.details.operational.active_flag === 1 ? 0 : 1;
    const statusText = newStatus === 1 ? 'activate' : 'deactivate';

    if (!confirm(`Are you sure you want to ${statusText} this tenant?`)) return;

    this.loading = true;
    this.cdr.markForCheck();

    this.tenantService.updateTenantStatus(this.tenantId, newStatus)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.success(`Tenant ${statusText}d successfully`, 'Success');
            this.loadDetails();
          } else {
            this.toastService.error(response.message || `Failed to ${statusText} tenant`, 'Error');
          }
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.toastService.error(err.error?.message || `Failed to ${statusText} tenant`, 'Error');
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) {
      this.logoFile = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        this.logoPreview = e.target?.result as string;
        this.cdr.markForCheck();
      };
      reader.readAsDataURL(this.logoFile);
    }
  }

  uploadLogo(): void {
    if (!this.tenantId || !this.logoFile) return;

    this.loading = true;
    this.cdr.markForCheck();

    this.tenantService.uploadLogo(this.tenantId, this.logoFile)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.logoFile = null;
            this.logoPreview = null;
            this.toastService.success('Logo uploaded successfully', 'Success');
            this.loadDetails();
          } else {
            this.toastService.error(response.message || 'Failed to upload logo', 'Error');
          }
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.toastService.error(err.error?.message || 'Failed to upload logo', 'Error');
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  deleteLogo(): void {
    if (!this.tenantId) return;
    if (!confirm('Are you sure you want to delete the tenant logo?')) return;

    this.loading = true;
    this.cdr.markForCheck();

    this.tenantService.deleteLogo(this.tenantId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.success('Logo deleted successfully', 'Success');
            this.loadDetails();
          } else {
            this.toastService.error(response.message || 'Failed to delete logo', 'Error');
          }
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.toastService.error(err.error?.message || 'Failed to delete logo', 'Error');
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  get headerStatusLabel(): string | undefined {
    if (!this.details) return undefined;
    const op = this.details.operational.active ? 'Active' : 'Inactive';
    const sub = this.formatSubscriptionStatus(this.details.subscription.status ?? null);
    return `${op} · ${sub}`;
  }

  get headerStatusTone(): StatusBadgeTone {
    if (!this.details) return 'neutral';
    const status = this.details.subscription.status;
    if (!this.details.operational.active) return 'critical';
    return this.subscriptionStatusTone(status ?? null);
  }

  getLogoUrl(): string {
    if (this.logoPreview) return this.logoPreview;
    if (this.details?.identity.logo_full_url) return this.details.identity.logo_full_url;
    if (this.details?.identity.logo_url) {
      const url = this.details.identity.logo_url;
      if (url.startsWith('http')) return url;
      const baseUrl = environment.apiUrl.replace('/api', '');
      return `${baseUrl}/${url.replace(/^\//, '')}`;
    }
    return '';
  }

  formatDate(dateString: string | null | undefined): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      });
    } catch {
      return value;
    }
  }

  formatSubscriptionStatus(status: string | null): string {
    if (!status) return '—';
    const labels: Record<string, string> = {
      TRIAL: 'Trial', ACTIVE: 'Active', LIFETIME: 'Lifetime', EXPIRING: 'Expiring soon',
      GRACE_PERIOD: 'Grace period', EXPIRED: 'Expired', SUSPENDED: 'Suspended',
    };
    return labels[status] || status;
  }

  subscriptionStatusTone(status: string | null): StatusBadgeTone {
    switch (status) {
      case 'ACTIVE': case 'LIFETIME': case 'TRIAL': return 'success';
      case 'EXPIRING': case 'GRACE_PERIOD': return 'warning';
      case 'EXPIRED': case 'SUSPENDED': return 'critical';
      default: return 'neutral';
    }
  }

  accessModeLabel(mode: string | null | undefined): string {
    if (!mode) return '—';
    return mode === 'read_only' ? 'Read only' : 'Full access';
  }

  moduleStatusLabel(mod: { entitled: boolean; accessible: boolean; access_mode: string }): string {
    if (!mod.entitled) return 'Not entitled';
    if (!mod.accessible) return 'Entitled · Blocked';
    if (mod.access_mode === 'read_only') return 'Entitled · Read only';
    return 'Entitled · Active';
  }

  moduleStatusTone(mod: { entitled: boolean; accessible: boolean; access_mode: string }): StatusBadgeTone {
    if (!mod.entitled) return 'neutral';
    if (!mod.accessible) return 'critical';
    if (mod.access_mode === 'read_only') return 'warning';
    return 'success';
  }

  warningTone(severity: string): StatusBadgeTone {
    if (severity === 'critical') return 'critical';
    if (severity === 'warning') return 'warning';
    return 'info';
  }

  kpiEntries(): Array<{ label: string; value: string }> {
    if (!this.details) return [];
    const k = this.details.kpis;
    const entries: Array<{ label: string; value: string }> = [];

    if (k['families'] != null) entries.push({ label: 'Families', value: String(k['families']) });
    if (k['members'] != null) entries.push({ label: 'Members', value: String(k['members']) });
    if (k['users'] != null) entries.push({ label: 'Users', value: String(k['users']) });
    if (k['active_users'] != null) entries.push({ label: 'Active users', value: String(k['active_users']) });
    if (k['frequent_users_30d'] != null) entries.push({ label: 'Frequent (30d)', value: String(k['frequent_users_30d']) });
    if (k['seen_last_7d'] != null) entries.push({ label: 'Seen (7d)', value: String(k['seen_last_7d']) });
    if (k['enabled_modules'] != null) entries.push({ label: 'Modules', value: String(k['enabled_modules']) });
    if (k['days_until_end'] != null) entries.push({ label: 'Days left', value: String(k['days_until_end']) });
    if (k['storage_used_mb'] != null && k['storage_max_mb'] != null) {
      entries.push({ label: 'Storage', value: `${k['storage_used_mb']} / ${k['storage_max_mb']} MB` });
    }

    return entries;
  }

  onAuditFilterChange(): void { this.loadSubscriptionAudits(true); }

  goToAuditPage(page: number): void {
    if (page < 1 || page > this.auditsLastPage || page === this.auditsPage) return;
    this.auditsPage = page;
    this.loadSubscriptionAudits(false);
  }

  toggleAuditDetails(auditId: number): void {
    this.expandedAuditId = this.expandedAuditId === auditId ? null : auditId;
    this.cdr.markForCheck();
  }

  auditOperationEntries(): Array<{ value: string; label: string }> {
    return Object.entries(this.auditOperations).map(([value, label]) => ({ value, label }));
  }

  loadSubscriptionPlans(): void {
    this.plansLoading = true;
    this.plansLoadError = null;
    this.cdr.markForCheck();

    this.tenantService.getSubscriptionPlans()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.availablePlans = response.data;
            if ((response as any).currency) this.currency = (response as any).currency;
            if ((response as any).duration_options) {
              this.durationOptions = (response as any).duration_options;
              this.resetSubscriptionDuration();
            }
            this.plansLoadError = null;
          } else {
            this.availablePlans = {};
            this.plansLoadError = (response as { message?: string }).message || 'Unable to load subscription plans.';
          }
          this.plansLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.availablePlans = {};
          this.plansLoadError = this.extractErrorMessage(err, 'Failed to load subscription plans');
          this.plansLoading = false;
          this.cdr.markForCheck();
        },
      });
  }

  openUpgradeModal(): void {
    if (this.tenant) this.selectedPlan = this.tenant.plan;
    this.subscriptionReason = '';
    this.resetSubscriptionDuration();
    this.showUpgradeModal = true;
    if (!this.plansLoading && (this.plansLoadError || this.getAvailablePlanKeys().length === 0)) {
      this.loadSubscriptionPlans();
    }
    this.cdr.markForCheck();
  }

  closeUpgradeModal(): void {
    if (this.subscriptionActionSaving) return;
    this.showUpgradeModal = false;
    this.selectedPlan = '';
    this.subscriptionReason = '';
    this.cdr.markForCheck();
  }

  selectPlan(planKey: string): void {
    if (!this.canSelectPlan(planKey) || this.subscriptionActionSaving) return;
    this.selectedPlan = planKey;
    this.cdr.markForCheck();
  }

  canConfirmPlanChange(): boolean {
    return !!this.selectedPlan && !this.subscriptionActionSaving && !this.plansLoading
      && this.getAvailablePlanKeys().length > 0 && this.durationOptions.length > 0
      && this.canSelectPlan(this.selectedPlan) && this.selectedPlan !== this.tenant?.plan;
  }

  upgradeSubscription(): void {
    if (!this.tenantId || !this.selectedPlan || this.subscriptionActionSaving) return;
    if (!this.canConfirmPlanChange()) {
      this.toastService.error('Choose a different plan to continue', 'Invalid selection');
      return;
    }

    this.subscriptionActionSaving = true;
    this.cdr.markForCheck();

    this.tenantService.upgradeSubscription(this.tenantId, this.selectedPlan, this.subscriptionDuration, this.normalizedReason())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.subscriptionActionSaving = false;
            this.closeUpgradeModal();
            this.toastService.success('Subscription plan updated', 'Saved');
            this.loadDetails();
            this.loadSubscriptionAudits(true);
          } else {
            this.toastService.error(response.message || 'Failed to update subscription', 'Error');
            this.subscriptionActionSaving = false;
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.toastService.error(this.extractErrorMessage(err, 'Failed to update subscription'), 'Error');
          this.subscriptionActionSaving = false;
          this.cdr.markForCheck();
        },
      });
  }

  openRenewModal(): void {
    this.subscriptionReason = '';
    this.resetSubscriptionDuration();
    this.showRenewModal = true;
    if (!this.plansLoading && (this.plansLoadError || this.durationOptions.length === 0)) {
      this.loadSubscriptionPlans();
    }
    this.cdr.markForCheck();
  }

  closeRenewModal(): void {
    if (this.subscriptionActionSaving) return;
    this.showRenewModal = false;
    this.subscriptionReason = '';
    this.cdr.markForCheck();
  }

  renewSubscription(): void {
    if (!this.tenantId || this.subscriptionActionSaving) return;
    if (this.durationOptions.length === 0) {
      this.toastService.error('Duration options are not available.', 'Error');
      return;
    }

    this.subscriptionActionSaving = true;
    this.cdr.markForCheck();

    this.tenantService.renewSubscription(this.tenantId, this.subscriptionDuration, this.normalizedReason())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.subscriptionActionSaving = false;
            this.toastService.success('Subscription renewed', 'Saved');
            this.closeRenewModal();
            this.loadDetails();
            this.loadSubscriptionAudits(true);
            this.setActiveTab('subscription');
          } else {
            this.toastService.error(response.message || 'Failed to renew subscription', 'Error');
            this.subscriptionActionSaving = false;
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.toastService.error(this.extractErrorMessage(err, 'Failed to renew subscription'), 'Error');
          this.subscriptionActionSaving = false;
          this.cdr.markForCheck();
        },
      });
  }

  openSuspendModal(): void { this.subscriptionReason = ''; this.showSuspendModal = true; this.cdr.markForCheck(); }
  closeSuspendModal(): void { if (!this.subscriptionActionSaving) { this.showSuspendModal = false; this.subscriptionReason = ''; this.cdr.markForCheck(); } }
  openReactivateModal(): void { this.subscriptionReason = ''; this.showReactivateModal = true; this.cdr.markForCheck(); }
  closeReactivateModal(): void { if (!this.subscriptionActionSaving) { this.showReactivateModal = false; this.subscriptionReason = ''; this.cdr.markForCheck(); } }

  isSubscriptionSuspended(): boolean {
    return !!this.details?.subscription.subscription_suspended_at
      || this.details?.subscription.status === 'SUSPENDED';
  }

  suspendSubscription(): void {
    if (!this.tenantId || this.subscriptionActionSaving) return;
    this.subscriptionActionSaving = true;
    this.cdr.markForCheck();

    this.tenantService.suspendSubscription(this.tenantId, this.normalizedReason())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.subscriptionActionSaving = false;
            this.closeSuspendModal();
            this.toastService.success('Subscription access suspended', 'Saved');
            this.loadDetails();
            this.loadSubscriptionAudits(true);
          } else {
            this.toastService.error(response.message || 'Failed to suspend subscription', 'Error');
            this.subscriptionActionSaving = false;
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.toastService.error(this.extractErrorMessage(err, 'Failed to suspend subscription'), 'Error');
          this.subscriptionActionSaving = false;
          this.cdr.markForCheck();
        },
      });
  }

  reactivateSubscription(): void {
    if (!this.tenantId || this.subscriptionActionSaving) return;
    this.subscriptionActionSaving = true;
    this.cdr.markForCheck();

    this.tenantService.reactivateSubscription(this.tenantId, this.normalizedReason())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.subscriptionActionSaving = false;
            this.closeReactivateModal();
            this.toastService.success('Subscription access reactivated', 'Saved');
            this.loadDetails();
            this.loadSubscriptionAudits(true);
          } else {
            this.toastService.error(response.message || 'Failed to reactivate subscription', 'Error');
            this.subscriptionActionSaving = false;
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.toastService.error(this.extractErrorMessage(err, 'Failed to reactivate subscription'), 'Error');
          this.subscriptionActionSaving = false;
          this.cdr.markForCheck();
        },
      });
  }

  getPlanName(planKey: string): string { return this.availablePlans[planKey]?.name || planKey; }
  getPlanPrice(planKey: string): number { return this.availablePlans[planKey]?.price || 0; }

  formatPrice(price: number): string {
    if (price === 0) return 'Free';
    if (this.currency === 'INR') return `₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (this.currency === 'USD') return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `${this.getCurrencySymbol()}${price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  getCurrencySymbol(): string {
    const map: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
    return map[this.currency] || '₹';
  }

  getPlanRank(planKey: string): number {
    const idx = PLAN_RANK_LADDER.indexOf(planKey as typeof PLAN_RANK_LADDER[number]);
    if (idx >= 0) return idx;
    const keys = this.getAvailablePlanKeys();
    const i = keys.indexOf(planKey);
    return i >= 0 ? PLAN_RANK_LADDER.length + i : 999;
  }

  canUpgradeTo(planKey: string): boolean {
    if (!this.tenant) return false;
    const currentIndex = this.getPlanRank(this.tenant.plan);
    const targetIndex = this.getPlanRank(planKey);
    return targetIndex > currentIndex || planKey === 'free';
  }

  canSelectPlan(planKey: string): boolean {
    if (!this.tenant) return false;
    if (this.tenant.plan === planKey) return true;
    return this.canUpgradeTo(planKey);
  }

  getAvailablePlanKeys(): string[] { return Object.keys(this.availablePlans || {}); }

  private resetSubscriptionDuration(): void {
    if (this.durationOptions.length > 0) {
      const def = this.durationOptions.find(o => o.value === 12) || this.durationOptions[0];
      this.subscriptionDuration = def.value;
    } else {
      this.subscriptionDuration = 12;
    }
  }

  getNewEndDate(currentEndDate: string | null, months: number): string {
    const monthsNum = Number(months) || 12;
    if (!currentEndDate) {
      const d = new Date();
      d.setMonth(d.getMonth() + monthsNum);
      return this.formatDate(d.toISOString());
    }
    const current = new Date(currentEndDate);
    if (current < new Date()) {
      const d = new Date();
      d.setMonth(d.getMonth() + monthsNum);
      return this.formatDate(d.toISOString());
    }
    current.setMonth(current.getMonth() + monthsNum);
    return this.formatDate(current.toISOString());
  }

  formatUsersLimit(value: number | null | undefined): string {
    if (value == null) return '—';
    return value >= 999999 ? 'Unlimited' : value.toLocaleString();
  }

  formatStorageLimit(value: number | null | undefined): string {
    if (value == null) return '—';
    if (value >= 1024) {
      const gb = value / 1024;
      return `${(gb >= 10 ? Math.round(gb) : Math.round(gb * 10) / 10).toLocaleString()} GB`;
    }
    return `${value.toLocaleString()} MB`;
  }

  confirmPlanActionLabel(): string {
    if (!this.selectedPlan) return 'Update plan';
    if (this.selectedPlan === 'free') return 'Switch to Free';
    if (this.canUpgradeTo(this.selectedPlan)) return 'Change plan';
    return 'Switch plan';
  }

  private normalizedReason(): string | undefined {
    const reason = this.subscriptionReason.trim();
    return reason.length ? reason.slice(0, 500) : undefined;
  }

  private extractErrorMessage(err: unknown, fallback: string): string {
    if (!err || typeof err !== 'object') return fallback;
    const e = err as { message?: string; error?: { message?: string } };
    return e.message || e.error?.message || fallback;
  }

  getUserPreviewPhotoUrl(user: TenantDetailsUserPreview): string | null {
    return resolveUserProfileImageUrl(user);
  }

  openPhotoViewer(user: TenantDetailsUserPreview, event: Event): void {
    event.stopPropagation();
    const url = this.getUserPreviewPhotoUrl(user);
    if (!url) {
      return;
    }

    this.photoViewer = {
      src: url,
      alt: user.name,
      title: user.name,
      subtitle: user.email,
    };
    this.cdr.markForCheck();
  }

  closePhotoViewer(): void {
    this.photoViewer = null;
    this.cdr.markForCheck();
  }
}
