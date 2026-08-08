/**
 * Subscription Management Component
 * Platform catalog: access windows, duration options, and plans (no payments).
 */

import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TenantService } from '@core/services/tenant.service';
import { ToastService } from '@core/services/toast.service';
import { ActionBarComponent, ActionBarItem } from '@shared/components/action-bar/action-bar.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import { TabStripComponent, TabStripItem } from '@shared/components/tab-strip/tab-strip.component';
import { Subject, takeUntil } from 'rxjs';

interface DurationOption {
  id?: number;
  months: number;
  label: string;
  display_order: number;
  active: boolean;
}

interface SubscriptionPlan {
  id?: number;
  key: string;
  name: string;
  description?: string;
  price: number;
  max_users: number;
  max_storage_mb: number;
  features?: string[];
  display_order: number;
  active: boolean;
  is_default: boolean;
}

type SubMgmtTab = 'settings' | 'duration' | 'plans';

@Component({
  selector: 'app-subscription-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageHeaderComponent,
    TabStripComponent,
    LoadingSkeletonComponent,
    StatusBadgeComponent,
    CfEmptyStateComponent,
    DataTableComponent,
    ActionBarComponent,
    ModalShellComponent,
  ],
  templateUrl: './subscription-management.component.html',
  styleUrls: ['./subscription-management.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SubscriptionManagementComponent implements OnInit, OnDestroy {
  private tenantService = inject(TenantService);
  private toastService = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  activeTab: SubMgmtTab = 'settings';

  settingsForm = {
    grace_period_days: 7,
    expiring_warning_days: 14
  };
  settingsLoading = false;
  settingsSaving = false;
  settingsError: string | null = null;
  settingsLoaded = false;

  durationOptions: DurationOption[] = [];
  durationsLoading = false;
  durationsError: string | null = null;

  plans: SubscriptionPlan[] = [];
  plansLoading = false;
  plansError: string | null = null;

  availableFeatures: string[] = [
    'events',
    'donations',
    'groups',
    'messaging',
    'custom_branding',
    'api_access',
    'dedicated_support',
    'advanced_reporting',
    'multi_location',
    'volunteer_management',
  ];

  /** True while a modal create/update/delete request is in flight */
  saving = false;

  showAddModal = false;
  showEditModal = false;
  showDeleteModal = false;

  showAddPlanModal = false;
  showEditPlanModal = false;
  showDeletePlanModal = false;

  formData: DurationOption = {
    months: 1,
    label: '',
    display_order: 0,
    active: true
  };

  planFormData: SubscriptionPlan = {
    key: '',
    name: '',
    description: '',
    price: 0,
    max_users: 10,
    max_storage_mb: 100,
    features: [],
    display_order: 0,
    active: true,
    is_default: false
  };

  editingOption: DurationOption | null = null;
  deletingOption: DurationOption | null = null;
  editingPlan: SubscriptionPlan | null = null;
  deletingPlan: SubscriptionPlan | null = null;

  readonly tabs: { id: SubMgmtTab; label: string }[] = [
    { id: 'settings', label: 'Access settings' },
    { id: 'duration', label: 'Duration options' },
    { id: 'plans', label: 'Subscription plans' },
  ];

  private static readonly FEATURE_PREVIEW_COUNT = 3;

  get tabStripItems(): TabStripItem[] {
    return this.tabs.map((tab) => ({
      id: tab.id,
      label: tab.label,
      domId: `sub-mgmt-tab-${tab.id}`,
      ariaControls: `sub-mgmt-panel-${tab.id}`,
    }));
  }

  ngOnInit(): void {
    this.loadSettings();
    this.loadDurationOptions();
    this.loadPlans();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setActiveTab(tab: SubMgmtTab): void {
    this.activeTab = tab;
    this.cdr.markForCheck();
  }

  onTabChange(tabId: string): void {
    if (tabId === 'settings' || tabId === 'duration' || tabId === 'plans') {
      this.setActiveTab(tabId);
    }
  }

  durationRowActions(): ActionBarItem[] {
    return [
      { id: 'edit', label: 'Edit', tier: 'secondary', disabled: this.saving },
      { id: 'delete', label: 'Delete', tier: 'danger', disabled: this.saving },
    ];
  }

  planRowActions(): ActionBarItem[] {
    return [
      { id: 'edit', label: 'Edit', tier: 'secondary', disabled: this.saving },
      { id: 'delete', label: 'Delete', tier: 'danger', disabled: this.saving },
    ];
  }

  onDurationRowAction(actionId: string, option: DurationOption): void {
    if (actionId === 'edit') {
      this.openEditModal(option);
      return;
    }
    if (actionId === 'delete') {
      this.openDeleteModal(option);
    }
  }

  onPlanRowAction(actionId: string, plan: SubscriptionPlan): void {
    if (actionId === 'edit') {
      this.openEditPlanModal(plan);
      return;
    }
    if (actionId === 'delete') {
      this.openDeletePlanModal(plan);
    }
  }

  visibleFeatures(features?: string[]): string[] {
    return (features || []).slice(0, SubscriptionManagementComponent.FEATURE_PREVIEW_COUNT);
  }

  extraFeatureCount(features?: string[]): number {
    const len = features?.length ?? 0;
    const preview = SubscriptionManagementComponent.FEATURE_PREVIEW_COUNT;
    return len > preview ? len - preview : 0;
  }

  loadSettings(): void {
    this.settingsLoading = true;
    this.settingsError = null;
    this.cdr.markForCheck();

    this.tenantService.getSubscriptionSettings()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.settingsForm = {
              grace_period_days: response.data.grace_period_days,
              expiring_warning_days: response.data.expiring_warning_days
            };
            this.settingsLoaded = true;
          } else {
            this.settingsError = this.friendlyError(response.message, 'Unable to load access settings.');
          }
          this.settingsLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.settingsError = this.friendlyError(this.extractErrorMessage(err), 'Unable to load access settings.');
          this.settingsLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  saveSettings(): void {
    if (this.settingsForm.grace_period_days < 0 || this.settingsForm.expiring_warning_days < 0) {
      this.toastService.error('Days cannot be negative', 'Check your entries');
      return;
    }
    this.settingsSaving = true;
    this.cdr.markForCheck();

    this.tenantService.updateSubscriptionSettings(this.settingsForm)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.settingsForm = {
              grace_period_days: response.data.grace_period_days,
              expiring_warning_days: response.data.expiring_warning_days
            };
            this.toastService.success('Access settings saved', 'Saved');
          } else {
            this.toastService.error(this.friendlyError(response.message, 'Unable to save access settings.'), 'Error');
          }
          this.settingsSaving = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.toastService.error(this.friendlyError(this.extractErrorMessage(err), 'Unable to save access settings.'), 'Error');
          this.settingsSaving = false;
          this.cdr.markForCheck();
        }
      });
  }

  loadDurationOptions(): void {
    this.durationsLoading = true;
    this.durationsError = null;
    this.cdr.markForCheck();

    this.tenantService.getDurationOptions()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && Array.isArray(response.data)) {
            this.durationOptions = response.data;
          } else {
            this.durationsError = this.friendlyError(response.message, 'Unable to load duration options.');
          }
          this.durationsLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.durationsError = this.friendlyError(this.extractErrorMessage(err), 'Unable to load duration options.');
          this.durationsLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  openAddModal(): void {
    this.formData = {
      months: 1,
      label: '',
      display_order: this.durationOptions.length > 0
        ? Math.max(...this.durationOptions.map(o => o.display_order)) + 1
        : 0,
      active: true
    };
    this.showAddModal = true;
    this.cdr.markForCheck();
  }

  closeAddModal(): void {
    if (this.saving) {
      return;
    }
    this.showAddModal = false;
    this.resetDurationForm();
    this.cdr.markForCheck();
  }

  openEditModal(option: DurationOption): void {
    this.editingOption = option;
    this.formData = { ...option };
    this.showEditModal = true;
    this.cdr.markForCheck();
  }

  closeEditModal(): void {
    if (this.saving) {
      return;
    }
    this.showEditModal = false;
    this.editingOption = null;
    this.resetDurationForm();
    this.cdr.markForCheck();
  }

  openDeleteModal(option: DurationOption): void {
    this.deletingOption = option;
    this.showDeleteModal = true;
    this.cdr.markForCheck();
  }

  closeDeleteModal(): void {
    if (this.saving) {
      return;
    }
    this.showDeleteModal = false;
    this.deletingOption = null;
    this.cdr.markForCheck();
  }

  createDurationOption(): void {
    if (!this.validateDurationForm() || this.saving) {
      return;
    }

    this.saving = true;
    this.cdr.markForCheck();

    this.tenantService.createDurationOption(this.formData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.success('Duration option created', 'Saved');
            this.saving = false;
            this.closeAddModal();
            this.loadDurationOptions();
          } else {
            this.toastService.error(this.friendlyError(response.message, 'Unable to create duration option.'), 'Error');
            this.saving = false;
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.toastService.error(this.friendlyError(this.extractErrorMessage(err), 'Unable to create duration option.'), 'Error');
          this.saving = false;
          this.cdr.markForCheck();
        }
      });
  }

  updateDurationOption(): void {
    if (!this.editingOption || !this.validateDurationForm() || this.saving) {
      return;
    }

    this.saving = true;
    this.cdr.markForCheck();

    this.tenantService.updateDurationOption(this.editingOption.id!, this.formData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.success('Duration option updated', 'Saved');
            this.saving = false;
            this.closeEditModal();
            this.loadDurationOptions();
          } else {
            this.toastService.error(this.friendlyError(response.message, 'Unable to update duration option.'), 'Error');
            this.saving = false;
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.toastService.error(this.friendlyError(this.extractErrorMessage(err), 'Unable to update duration option.'), 'Error');
          this.saving = false;
          this.cdr.markForCheck();
        }
      });
  }

  deleteDurationOption(): void {
    if (!this.deletingOption || this.saving) {
      return;
    }

    this.saving = true;
    this.cdr.markForCheck();

    this.tenantService.deleteDurationOption(this.deletingOption.id!)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.success('Duration option deleted', 'Deleted');
            this.saving = false;
            this.closeDeleteModal();
            this.loadDurationOptions();
          } else {
            this.toastService.error(this.friendlyError(response.message, 'Unable to delete duration option.'), 'Error');
            this.saving = false;
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.toastService.error(this.friendlyError(this.extractErrorMessage(err), 'Unable to delete duration option.'), 'Error');
          this.saving = false;
          this.cdr.markForCheck();
        }
      });
  }

  validateDurationForm(): boolean {
    if (!this.formData.months || this.formData.months < 1) {
      this.toastService.error('Months must be at least 1', 'Check your entries');
      return false;
    }

    if (!this.formData.label || this.formData.label.trim().length === 0) {
      this.toastService.error('Label is required', 'Check your entries');
      return false;
    }

    const existingOption = this.durationOptions.find(
      opt => opt.months === this.formData.months &&
      (!this.editingOption || opt.id !== this.editingOption.id)
    );

    if (existingOption) {
      this.toastService.error('A duration option with this number of months already exists', 'Check your entries');
      return false;
    }

    return true;
  }

  loadPlans(): void {
    this.plansLoading = true;
    this.plansError = null;
    this.cdr.markForCheck();

    this.tenantService.getPlans()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && Array.isArray(response.data)) {
            this.plans = response.data;
          } else {
            this.plansError = this.friendlyError(response.message, 'Unable to load subscription plans.');
          }
          this.plansLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.plansError = this.friendlyError(this.extractErrorMessage(err), 'Unable to load subscription plans.');
          this.plansLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  openAddPlanModal(): void {
    this.planFormData = {
      key: '',
      name: '',
      description: '',
      price: 0,
      max_users: 10,
      max_storage_mb: 100,
      features: [],
      display_order: this.plans.length > 0
        ? Math.max(...this.plans.map(p => p.display_order)) + 1
        : 0,
      active: true,
      is_default: false
    };
    this.showAddPlanModal = true;
    this.cdr.markForCheck();
  }

  closeAddPlanModal(): void {
    if (this.saving) {
      return;
    }
    this.showAddPlanModal = false;
    this.resetPlanForm();
    this.cdr.markForCheck();
  }

  openEditPlanModal(plan: SubscriptionPlan): void {
    this.editingPlan = plan;
    this.planFormData = {
      ...plan,
      features: [...(plan.features || [])],
    };
    this.showEditPlanModal = true;
    this.cdr.markForCheck();
  }

  closeEditPlanModal(): void {
    if (this.saving) {
      return;
    }
    this.showEditPlanModal = false;
    this.editingPlan = null;
    this.resetPlanForm();
    this.cdr.markForCheck();
  }

  openDeletePlanModal(plan: SubscriptionPlan): void {
    this.deletingPlan = plan;
    this.showDeletePlanModal = true;
    this.cdr.markForCheck();
  }

  closeDeletePlanModal(): void {
    if (this.saving) {
      return;
    }
    this.showDeletePlanModal = false;
    this.deletingPlan = null;
    this.cdr.markForCheck();
  }

  createPlan(): void {
    if (!this.validatePlanForm() || this.saving) {
      return;
    }

    this.saving = true;
    this.cdr.markForCheck();

    this.tenantService.createPlan(this.planFormData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.success('Subscription plan created', 'Saved');
            this.saving = false;
            this.closeAddPlanModal();
            this.loadPlans();
          } else {
            this.toastService.error(this.friendlyError(response.message, 'Unable to create plan.'), 'Error');
            this.saving = false;
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.toastService.error(this.friendlyError(this.extractErrorMessage(err), 'Unable to create plan.'), 'Error');
          this.saving = false;
          this.cdr.markForCheck();
        }
      });
  }

  updatePlan(): void {
    if (!this.editingPlan || !this.validatePlanForm() || this.saving) {
      return;
    }

    this.saving = true;
    this.cdr.markForCheck();

    this.tenantService.updatePlan(this.editingPlan.id!, this.planFormData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.success('Subscription plan updated', 'Saved');
            this.saving = false;
            this.closeEditPlanModal();
            this.loadPlans();
          } else {
            this.toastService.error(this.friendlyError(response.message, 'Unable to update plan.'), 'Error');
            this.saving = false;
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.toastService.error(this.friendlyError(this.extractErrorMessage(err), 'Unable to update plan.'), 'Error');
          this.saving = false;
          this.cdr.markForCheck();
        }
      });
  }

  deletePlan(): void {
    if (!this.deletingPlan || this.saving) {
      return;
    }

    if (this.deletingPlan.active) {
      this.toastService.error(
        'Deactivate this plan before deleting it.',
        'Cannot delete'
      );
      return;
    }

    this.saving = true;
    this.cdr.markForCheck();

    this.tenantService.deletePlan(this.deletingPlan.id!)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.success('Subscription plan deleted', 'Deleted');
            this.saving = false;
            this.closeDeletePlanModal();
            this.loadPlans();
          } else {
            this.toastService.error(this.friendlyError(response.message, 'Unable to delete plan.'), 'Error');
            this.saving = false;
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.toastService.error(this.friendlyError(this.extractErrorMessage(err), 'Unable to delete plan.'), 'Error');
          this.saving = false;
          this.cdr.markForCheck();
        }
      });
  }

  validatePlanForm(): boolean {
    if (!this.planFormData.key || this.planFormData.key.trim().length === 0) {
      this.toastService.error('Plan key is required', 'Check your entries');
      return false;
    }

    if (!this.planFormData.name || this.planFormData.name.trim().length === 0) {
      this.toastService.error('Plan name is required', 'Check your entries');
      return false;
    }

    if (this.planFormData.price < 0) {
      this.toastService.error('Catalog price cannot be negative', 'Check your entries');
      return false;
    }

    if (this.planFormData.max_users < 1) {
      this.toastService.error('User limit must be at least 1', 'Check your entries');
      return false;
    }

    if (this.planFormData.max_storage_mb < 1) {
      this.toastService.error('Storage must be at least 1 MB', 'Check your entries');
      return false;
    }

    const existingPlan = this.plans.find(
      p => p.key === this.planFormData.key &&
      (!this.editingPlan || p.id !== this.editingPlan.id)
    );

    if (existingPlan) {
      this.toastService.error('A plan with this key already exists', 'Check your entries');
      return false;
    }

    return true;
  }

  toggleFeature(feature: string): void {
    if (!this.planFormData.features) {
      this.planFormData.features = [];
    }
    const index = this.planFormData.features.indexOf(feature);
    if (index > -1) {
      this.planFormData.features.splice(index, 1);
    } else {
      this.planFormData.features.push(feature);
    }
    this.cdr.markForCheck();
  }

  isFeatureSelected(feature: string): boolean {
    return this.planFormData.features?.includes(feature) || false;
  }

  featureLabel(feature: string): string {
    const map: Record<string, string> = {
      events: 'Events',
      donations: 'Donations',
      groups: 'Groups',
      messaging: 'Messaging',
      custom_branding: 'Custom branding',
      api_access: 'API access',
      dedicated_support: 'Dedicated support',
      advanced_reporting: 'Advanced reporting',
      multi_location: 'Multi-location',
      volunteer_management: 'Volunteer management',
      ministries_associations: 'Ministries & Associations',
    };
    return map[feature] || feature.replace(/_/g, ' ');
  }

  formatUsers(value: number): string {
    return value >= 999999 ? 'Unlimited' : value.toLocaleString();
  }

  formatStorage(value: number): string {
    if (value >= 1024) {
      const gb = value / 1024;
      const rounded = gb >= 10 ? Math.round(gb) : Math.round(gb * 10) / 10;
      return `${rounded.toLocaleString()} GB`;
    }
    return `${value.toLocaleString()} MB`;
  }

  formatPrice(value: number): string {
    return `₹${Number(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }

  private resetDurationForm(): void {
    this.formData = {
      months: 1,
      label: '',
      display_order: 0,
      active: true
    };
  }

  private resetPlanForm(): void {
    this.planFormData = {
      key: '',
      name: '',
      description: '',
      price: 0,
      max_users: 10,
      max_storage_mb: 100,
      features: [],
      display_order: 0,
      active: true,
      is_default: false
    };
  }

  private extractErrorMessage(err: unknown): string | null {
    if (!err || typeof err !== 'object') {
      return null;
    }
    const e = err as { message?: string; error?: { message?: string } };
    return e.message || e.error?.message || null;
  }

  private friendlyError(message: string | null | undefined, fallback: string): string {
    if (message && !/exception|stack|sqlstate|\bSQL\b|internal server/i.test(message)) {
      return message;
    }
    return fallback;
  }
}
