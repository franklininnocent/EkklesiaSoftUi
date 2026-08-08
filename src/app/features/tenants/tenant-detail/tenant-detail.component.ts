/**
 * Tenant Detail/Management Component
 * Comprehensive tenant management page with details, subscription, and actions
 */

import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TenantService } from '@core/services/tenant.service';
import { ToastService } from '@core/services/toast.service';
import { AuthService } from '@core/services/auth.service';
import { Tenant } from '@core/models/tenant.model';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { StatusBadgeComponent, StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';
import { Subject, takeUntil } from 'rxjs';
import { environment } from '@environments/environment';

/** Matches backend SubscriptionService::applyPlan ladder. */
const PLAN_RANK_LADDER = ['free', 'basic', 'premium', 'enterprise'] as const;

@Component({
  selector: 'app-tenant-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageHeaderComponent,
    StatusBadgeComponent,
    ModalShellComponent,
    CfEmptyStateComponent,
  ],
  templateUrl: './tenant-detail.component.html',
  styleUrls: ['./tenant-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TenantDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private tenantService = inject(TenantService);
  private toastService = inject(ToastService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  tenant: Tenant | null = null;
  loading = false;
  error: string | null = null;
  tenantId: number | null = null;

  // Tab management
  activeTab: 'details' | 'subscription' | 'actions' = 'details';

  // Edit mode
  isEditing = false;
  editForm: Partial<Tenant> = {};

  // Logo upload
  logoFile: File | null = null;
  logoPreview: string | null = null;

  // Subscription management
  availablePlans: Record<string, any> = {};
  currency: string = 'INR';
  durationOptions: Array<{value: number; label: string}> = [];
  selectedPlan: string = '';
  subscriptionDuration: number = 12;
  showUpgradeModal = false;
  showRenewModal = false;
  showSuspendModal = false;
  showReactivateModal = false;
  subscriptionStatus: string | null = null;
  /** Optional ops note stored on subscription audit rows */
  subscriptionReason = '';
  subscriptionActionSaving = false;
  plansLoading = false;
  plansLoadError: string | null = null;

  // Subscription audits (Super Admin ops visibility)
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
    this.route.params
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        this.tenantId = +params['id'];
        if (this.tenantId) {
          this.loadTenant();
          this.loadSubscriptionPlans();
          if (this.activeTab === 'subscription') {
            this.loadSubscriptionAudits(true);
          }
        }
      });

    // Check for tab query parameter to set active tab
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(queryParams => {
        if (queryParams['tab'] && ['details', 'subscription', 'actions'].includes(queryParams['tab'])) {
          this.setActiveTab(queryParams['tab'] as 'details' | 'subscription' | 'actions');
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load tenant details
   */
  loadTenant(): void {
    if (!this.tenantId) return;

    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.tenantService.getTenant(this.tenantId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.tenant = response.data;
            this.editForm = { ...response.data };
            this.subscriptionStatus = response.stats?.subscription_status || null;
          } else {
            this.error = response.message || 'Failed to load tenant';
          }
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = err.error?.message || 'Failed to load tenant details';
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Switch active tab
   */
  setActiveTab(tab: 'details' | 'subscription' | 'actions'): void {
    this.activeTab = tab;
    if (tab === 'subscription') {
      this.loadSubscriptionAudits(true);
    }
    this.cdr.markForCheck();
  }

  loadSubscriptionAudits(resetPage = false): void {
    if (!this.tenantId) {
      return;
    }
    if (resetPage) {
      this.auditsPage = 1;
    }

    this.auditsLoading = true;
    this.auditsError = null;
    this.cdr.markForCheck();

    this.tenantService
      .getSubscriptionAudits(this.tenantId, {
        page: this.auditsPage,
        per_page: 10,
        operation: this.auditFilterOperation || null,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
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

  onAuditFilterChange(): void {
    this.loadSubscriptionAudits(true);
  }

  goToAuditPage(page: number): void {
    if (page < 1 || page > this.auditsLastPage || page === this.auditsPage) {
      return;
    }
    this.auditsPage = page;
    this.loadSubscriptionAudits(false);
  }

  toggleAuditDetails(auditId: number): void {
    this.expandedAuditId = this.expandedAuditId === auditId ? null : auditId;
    this.cdr.markForCheck();
  }

  formatAuditDateTime(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }
    try {
      return new Date(value).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return value;
    }
  }

  auditOperationEntries(): Array<{ value: string; label: string }> {
    return Object.entries(this.auditOperations).map(([value, label]) => ({ value, label }));
  }

  /**
   * Toggle edit mode
   */
  toggleEdit(): void {
    this.isEditing = !this.isEditing;
    if (this.isEditing && this.tenant) {
      this.editForm = { ...this.tenant };
    }
    this.cdr.markForCheck();
  }

  /**
   * Save tenant changes
   */
  saveTenant(): void {
    if (!this.tenantId || !this.tenant) return;

    this.loading = true;
    this.cdr.markForCheck();

    this.tenantService.updateTenant(this.tenantId, this.editForm as any)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.tenant = response.data;
            this.isEditing = false;
            this.toastService.success('Tenant updated successfully', 'Success');
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
        }
      });
  }

  /**
   * Cancel editing
   */
  cancelEdit(): void {
    this.isEditing = false;
    if (this.tenant) {
      this.editForm = { ...this.tenant };
    }
    this.cdr.markForCheck();
  }

  /**
   * Toggle tenant active status
   */
  toggleTenantStatus(): void {
    if (!this.tenantId || !this.tenant) return;

    const newStatus: 0 | 1 = this.tenant.active === 1 ? 0 : 1;
    const statusText = newStatus === 1 ? 'activate' : 'deactivate';

    if (!confirm(`Are you sure you want to ${statusText} this tenant?`)) {
      return;
    }

    this.loading = true;
    this.cdr.markForCheck();

    this.tenantService.updateTenantStatus(this.tenantId, newStatus)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.tenant = response.data;
            this.toastService.success(`Tenant ${statusText}d successfully`, 'Success');
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
        }
      });
  }

  /**
   * Handle logo file selection
   */
  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.logoFile = input.files[0];
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        this.logoPreview = e.target?.result as string;
        this.cdr.markForCheck();
      };
      reader.readAsDataURL(this.logoFile);
    }
  }

  /**
   * Upload logo
   */
  uploadLogo(): void {
    if (!this.tenantId || !this.logoFile) return;

    this.loading = true;
    this.cdr.markForCheck();

    this.tenantService.uploadLogo(this.tenantId, this.logoFile)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            if (this.tenant) {
              this.tenant.logo_url = response.data.logo_url;
              this.tenant.logo_full_url = response.data.logo_full_url;
            }
            this.logoFile = null;
            this.logoPreview = null;
            this.toastService.success('Logo uploaded successfully', 'Success');
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
        }
      });
  }

  /**
   * Delete logo
   */
  deleteLogo(): void {
    if (!this.tenantId || !this.tenant) return;

    if (!confirm('Are you sure you want to delete the tenant logo?')) {
      return;
    }

    this.loading = true;
    this.cdr.markForCheck();

    this.tenantService.deleteLogo(this.tenantId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            if (this.tenant) {
              this.tenant.logo_url = null;
              this.tenant.logo_full_url = null;
            }
            this.toastService.success('Logo deleted successfully', 'Success');
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
        }
      });
  }

  /**
   * Status label for app-page-header badge
   */
  get headerStatusLabel(): string | undefined {
    return this.tenant ? this.getStatusText(this.tenant.active) : undefined;
  }

  /**
   * Status tone for app-page-header badge
   */
  get headerStatusTone(): StatusBadgeTone {
    return this.tenant?.active === 1 ? 'success' : 'neutral';
  }

  /**
   * Navigate back to tenants list
   */
  goBack(): void {
    this.router.navigate(['/tenants']);
  }

  /**
   * Get tenant logo URL
   */
  getLogoUrl(): string {
    if (!this.tenant) return '';
    
    if (this.tenant.logo_full_url) {
      return this.tenant.logo_full_url;
    }
    
    if (this.tenant.logo_url) {
      if (this.tenant.logo_url.startsWith('http://') || this.tenant.logo_url.startsWith('https://')) {
        return this.tenant.logo_url;
      }
      const baseUrl = environment.apiUrl.replace('/api', '');
      const cleanLogoUrl = this.tenant.logo_url.startsWith('/') 
        ? this.tenant.logo_url.substring(1) 
        : this.tenant.logo_url;
      return `${baseUrl}/${cleanLogoUrl}`;
    }
    
    return '';
  }

  /**
   * Format date
   */
  formatDate(dateString: string | null | undefined): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Get status badge class
   */
  getStatusBadgeClass(active: 0 | 1): string {
    return active === 1 ? 'status-active' : 'status-inactive';
  }

  /**
   * Get status text
   */
  getStatusText(active: 0 | 1): string {
    return active === 1 ? 'Active' : 'Inactive';
  }

  /**
   * Load available subscription plans
   */
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
            if ((response as any).currency) {
              this.currency = (response as any).currency;
            }
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
          console.error('Error loading subscription plans:', err);
          this.availablePlans = {};
          this.plansLoadError = this.extractErrorMessage(err, 'Failed to load subscription plans');
          this.plansLoading = false;
          this.toastService.error(this.plansLoadError, 'Error');
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Open upgrade modal
   */
  openUpgradeModal(): void {
    if (this.tenant) {
      this.selectedPlan = this.tenant.plan;
    }
    this.subscriptionReason = '';
    this.resetSubscriptionDuration();
    this.showUpgradeModal = true;
    if (!this.plansLoading && (this.plansLoadError || this.getAvailablePlanKeys().length === 0)) {
      this.loadSubscriptionPlans();
    }
    this.cdr.markForCheck();
  }

  /**
   * Close upgrade modal
   */
  closeUpgradeModal(): void {
    if (this.subscriptionActionSaving) {
      return;
    }
    this.showUpgradeModal = false;
    this.selectedPlan = '';
    this.subscriptionReason = '';
    this.cdr.markForCheck();
  }

  selectPlan(planKey: string): void {
    if (!this.canSelectPlan(planKey) || this.subscriptionActionSaving) {
      return;
    }
    this.selectedPlan = planKey;
    this.cdr.markForCheck();
  }

  canConfirmPlanChange(): boolean {
    return !!this.selectedPlan
      && !this.subscriptionActionSaving
      && !this.plansLoading
      && this.getAvailablePlanKeys().length > 0
      && this.durationOptions.length > 0
      && this.canSelectPlan(this.selectedPlan)
      && this.selectedPlan !== this.tenant?.plan;
  }

  /**
   * Upgrade subscription (or switch to Free plan)
   */
  upgradeSubscription(): void {
    if (!this.tenantId || !this.selectedPlan || this.subscriptionActionSaving) {
      return;
    }

    if (!this.canConfirmPlanChange()) {
      this.toastService.error('Choose a different plan to continue', 'Invalid selection');
      return;
    }

    if (!this.canUpgradeTo(this.selectedPlan) && this.selectedPlan !== 'free') {
      this.toastService.error('Only downgrades to Free are allowed for special cases', 'Invalid selection');
      return;
    }

    this.subscriptionActionSaving = true;
    this.cdr.markForCheck();

    this.tenantService
      .upgradeSubscription(
        this.tenantId,
        this.selectedPlan,
        this.subscriptionDuration,
        this.normalizedReason()
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            const responseData = response.data as any;
            this.tenant = responseData?.tenant || response.data;
            this.subscriptionStatus = responseData?.subscription_status || this.subscriptionStatus;
            this.subscriptionActionSaving = false;
            this.closeUpgradeModal();
            this.toastService.success('Subscription plan updated', 'Saved');
            this.loadTenant();
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
        }
      });
  }

  /**
   * Open renew modal
   */
  openRenewModal(): void {
    this.subscriptionReason = '';
    this.resetSubscriptionDuration();
    this.showRenewModal = true;
    if (!this.plansLoading && (this.plansLoadError || this.durationOptions.length === 0)) {
      this.loadSubscriptionPlans();
    }
    this.cdr.markForCheck();
  }

  /**
   * Close renew modal
   */
  closeRenewModal(): void {
    if (this.subscriptionActionSaving) {
      return;
    }
    this.showRenewModal = false;
    this.subscriptionReason = '';
    this.cdr.markForCheck();
  }

  /**
   * Renew subscription
   */
  renewSubscription(): void {
    if (!this.tenantId || this.subscriptionActionSaving) {
      return;
    }

    if (this.durationOptions.length === 0) {
      this.toastService.error('Duration options are not available. Try again after plans reload.', 'Error');
      return;
    }

    this.subscriptionActionSaving = true;
    this.cdr.markForCheck();

    this.tenantService
      .renewSubscription(this.tenantId, this.subscriptionDuration, this.normalizedReason())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.subscriptionActionSaving = false;
            this.toastService.success('Subscription renewed', 'Saved');
            this.closeRenewModal();
            this.loadTenant();
            this.loadSubscriptionAudits(true);
            this.activeTab = 'subscription';
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
        }
      });
  }

  openSuspendModal(): void {
    this.subscriptionReason = '';
    this.showSuspendModal = true;
    this.cdr.markForCheck();
  }

  closeSuspendModal(): void {
    if (this.subscriptionActionSaving) {
      return;
    }
    this.showSuspendModal = false;
    this.subscriptionReason = '';
    this.cdr.markForCheck();
  }

  openReactivateModal(): void {
    this.subscriptionReason = '';
    this.showReactivateModal = true;
    this.cdr.markForCheck();
  }

  closeReactivateModal(): void {
    if (this.subscriptionActionSaving) {
      return;
    }
    this.showReactivateModal = false;
    this.subscriptionReason = '';
    this.cdr.markForCheck();
  }

  /**
   * Get plan name
   */
  getPlanName(planKey: string): string {
    return this.availablePlans[planKey]?.name || planKey;
  }

  /**
   * Get plan price
   */
  getPlanPrice(planKey: string): number {
    return this.availablePlans[planKey]?.price || 0;
  }

  /**
   * Format price with currency symbol
   */
  formatPrice(price: number): string {
    if (price === 0) return 'Free';
    
    // Format based on currency
    if (this.currency === 'INR') {
      return `₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else if (this.currency === 'USD') {
      return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else {
      // Default formatting
      return `${this.getCurrencySymbol()}${price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  }

  /**
   * Get currency symbol
   */
  getCurrencySymbol(): string {
    const currencyMap: Record<string, string> = {
      'INR': '₹',
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
    };
    return currencyMap[this.currency] || '₹';
  }

  /**
   * Plan rank aligned with backend ladder, then catalog order for unknown keys.
   */
  getPlanRank(planKey: string): number {
    const ladderIdx = PLAN_RANK_LADDER.indexOf(planKey as typeof PLAN_RANK_LADDER[number]);
    if (ladderIdx >= 0) {
      return ladderIdx;
    }
    const keys = this.getAvailablePlanKeys();
    const idx = keys.indexOf(planKey);
    return idx >= 0 ? PLAN_RANK_LADDER.length + idx : 999;
  }

  /**
   * Check if plan is available for upgrade
   */
  canUpgradeTo(planKey: string): boolean {
    if (!this.tenant) return false;

    const currentIndex = this.getPlanRank(this.tenant.plan);
    const targetIndex = this.getPlanRank(planKey);

    // Allow upgrades (higher plans) and downgrades to Free plan (for grace periods/exceptions)
    return targetIndex > currentIndex || planKey === 'free';
  }

  /**
   * Check if a plan can be selected (upgrade, downgrade to Free, or current plan)
   */
  canSelectPlan(planKey: string): boolean {
    if (!this.tenant) return false;

    if (this.tenant.plan === planKey) return true;

    return this.canUpgradeTo(planKey);
  }

  getAvailablePlanKeys(): string[] {
    return Object.keys(this.availablePlans || {});
  }

  private resetSubscriptionDuration(): void {
    if (this.durationOptions.length > 0) {
      const defaultOption = this.durationOptions.find(opt => opt.value === 12) || this.durationOptions[0];
      this.subscriptionDuration = defaultOption.value;
    } else {
      this.subscriptionDuration = 12;
    }
  }

  formatSubscriptionStatus(status: string | null): string {
    if (!status) {
      return '—';
    }
    const labels: Record<string, string> = {
      TRIAL: 'Trial',
      ACTIVE: 'Active',
      LIFETIME: 'Lifetime',
      EXPIRING: 'Expiring soon',
      GRACE_PERIOD: 'Grace period',
      EXPIRED: 'Expired',
      SUSPENDED: 'Suspended',
    };
    return labels[status] || status;
  }

  subscriptionStatusTone(status: string | null): StatusBadgeTone {
    switch (status) {
      case 'ACTIVE':
      case 'LIFETIME':
      case 'TRIAL':
        return 'success';
      case 'EXPIRING':
      case 'GRACE_PERIOD':
        return 'warning';
      case 'EXPIRED':
      case 'SUSPENDED':
        return 'critical';
      default:
        return 'neutral';
    }
  }

  isSubscriptionSuspended(): boolean {
    return !!this.tenant?.subscription_suspended_at || this.subscriptionStatus === 'SUSPENDED';
  }

  suspendSubscription(): void {
    if (!this.tenantId || this.subscriptionActionSaving) {
      return;
    }
    this.subscriptionActionSaving = true;
    this.cdr.markForCheck();
    this.tenantService
      .suspendSubscription(this.tenantId, this.normalizedReason())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            const data = response.data as any;
            this.tenant = data?.tenant || response.data;
            this.subscriptionStatus = data?.subscription_status || 'SUSPENDED';
            this.subscriptionActionSaving = false;
            this.closeSuspendModal();
            this.toastService.success('Subscription access suspended', 'Saved');
            this.loadTenant();
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
        }
      });
  }

  reactivateSubscription(): void {
    if (!this.tenantId || this.subscriptionActionSaving) {
      return;
    }
    this.subscriptionActionSaving = true;
    this.cdr.markForCheck();
    this.tenantService
      .reactivateSubscription(this.tenantId, this.normalizedReason())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            const data = response.data as any;
            this.tenant = data?.tenant || response.data;
            this.subscriptionStatus = data?.subscription_status || null;
            this.subscriptionActionSaving = false;
            this.closeReactivateModal();
            this.toastService.success('Subscription access reactivated', 'Saved');
            this.loadTenant();
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
        }
      });
  }

  /**
   * Calculate new end date for renewal
   */
  getNewEndDate(currentEndDate: string | null, months: number): string {
    const monthsNum = Number(months) || 12;
    if (!currentEndDate) {
      const newDate = new Date();
      newDate.setMonth(newDate.getMonth() + monthsNum);
      return this.formatDate(newDate.toISOString());
    }

    const current = new Date(currentEndDate);
    const isExpired = current < new Date();

    if (isExpired) {
      const newDate = new Date();
      newDate.setMonth(newDate.getMonth() + monthsNum);
      return this.formatDate(newDate.toISOString());
    }

    current.setMonth(current.getMonth() + monthsNum);
    return this.formatDate(current.toISOString());
  }

  formatUsersLimit(value: number | null | undefined): string {
    if (value == null) {
      return '—';
    }
    return value >= 999999 ? 'Unlimited' : value.toLocaleString();
  }

  formatStorageLimit(value: number | null | undefined): string {
    if (value == null) {
      return '—';
    }
    if (value >= 1024) {
      const gb = value / 1024;
      const rounded = gb >= 10 ? Math.round(gb) : Math.round(gb * 10) / 10;
      return `${rounded.toLocaleString()} GB`;
    }
    return `${value.toLocaleString()} MB`;
  }

  confirmPlanActionLabel(): string {
    if (!this.selectedPlan) {
      return 'Update plan';
    }
    if (this.selectedPlan === 'free') {
      return 'Switch to Free';
    }
    if (this.canUpgradeTo(this.selectedPlan)) {
      return 'Change plan';
    }
    return 'Switch plan';
  }

  private normalizedReason(): string | undefined {
    const reason = this.subscriptionReason.trim();
    return reason.length ? reason.slice(0, 500) : undefined;
  }

  private extractErrorMessage(err: unknown, fallback: string): string {
    if (!err || typeof err !== 'object') {
      return fallback;
    }
    const e = err as { message?: string; error?: { message?: string } };
    return e.message || e.error?.message || fallback;
  }
}
