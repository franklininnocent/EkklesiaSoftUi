/**
 * Subscription Management Component
 * Manage subscription duration options and plans (Add, Update, Delete)
 */

import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TenantService } from '@core/services/tenant.service';
import { ToastService } from '@core/services/toast.service';
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

@Component({
  selector: 'app-subscription-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './subscription-management.component.html',
  styleUrls: ['./subscription-management.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SubscriptionManagementComponent implements OnInit, OnDestroy {
  private tenantService = inject(TenantService);
  private toastService = inject(ToastService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  // Tab management
  activeTab: 'duration' | 'plans' = 'duration';

  // Duration Options
  durationOptions: DurationOption[] = [];
  
  // Plans
  plans: SubscriptionPlan[] = [];
  availableFeatures: string[] = ['events', 'donations', 'groups', 'messaging', 'custom_branding', 'api_access', 'dedicated_support', 'advanced_reporting', 'multi_location', 'volunteer_management'];
  
  loading = false;
  error: string | null = null;

  // Modal states - Duration Options
  showAddModal = false;
  showEditModal = false;
  showDeleteModal = false;

  // Modal states - Plans
  showAddPlanModal = false;
  showEditPlanModal = false;
  showDeletePlanModal = false;

  // Form data - Duration Options
  formData: DurationOption = {
    months: 1,
    label: '',
    display_order: 0,
    active: true
  };

  // Form data - Plans
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

  ngOnInit(): void {
    this.loadDurationOptions();
    this.loadPlans();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Set active tab
   */
  setActiveTab(tab: 'duration' | 'plans'): void {
    this.activeTab = tab;
    this.cdr.markForCheck();
  }

  // ============================================
  // Duration Options Methods
  // ============================================

  /**
   * Load all duration options
   */
  loadDurationOptions(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.tenantService.getDurationOptions()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.durationOptions = response.data;
          } else {
            this.error = response.message || 'Failed to load duration options';
          }
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = err.error?.message || 'Failed to load duration options';
          this.loading = false;
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
    this.showAddModal = false;
    this.formData = {
      months: 1,
      label: '',
      display_order: 0,
      active: true
    };
    this.cdr.markForCheck();
  }

  openEditModal(option: DurationOption): void {
    this.editingOption = option;
    this.formData = { ...option };
    this.showEditModal = true;
    this.cdr.markForCheck();
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.editingOption = null;
    this.formData = {
      months: 1,
      label: '',
      display_order: 0,
      active: true
    };
    this.cdr.markForCheck();
  }

  openDeleteModal(option: DurationOption): void {
    this.deletingOption = option;
    this.showDeleteModal = true;
    this.cdr.markForCheck();
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.deletingOption = null;
    this.cdr.markForCheck();
  }

  createDurationOption(): void {
    if (!this.validateDurationForm()) {
      return;
    }

    this.loading = true;
    this.cdr.markForCheck();

    this.tenantService.createDurationOption(this.formData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.success('Duration option created successfully', 'Success');
            this.closeAddModal();
            this.loadDurationOptions();
          } else {
            this.toastService.error(response.message || 'Failed to create duration option', 'Error');
          }
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.toastService.error(err.error?.message || 'Failed to create duration option', 'Error');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  updateDurationOption(): void {
    if (!this.editingOption || !this.validateDurationForm()) {
      return;
    }

    this.loading = true;
    this.cdr.markForCheck();

    this.tenantService.updateDurationOption(this.editingOption.id!, this.formData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.success('Duration option updated successfully', 'Success');
            this.closeEditModal();
            this.loadDurationOptions();
          } else {
            this.toastService.error(response.message || 'Failed to update duration option', 'Error');
          }
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.toastService.error(err.error?.message || 'Failed to update duration option', 'Error');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  deleteDurationOption(): void {
    if (!this.deletingOption) {
      return;
    }

    this.loading = true;
    this.cdr.markForCheck();

    this.tenantService.deleteDurationOption(this.deletingOption.id!)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.success('Duration option deleted successfully', 'Success');
            this.closeDeleteModal();
            this.loadDurationOptions();
          } else {
            this.toastService.error(response.message || 'Failed to delete duration option', 'Error');
          }
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.toastService.error(err.error?.message || 'Failed to delete duration option', 'Error');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  validateDurationForm(): boolean {
    if (!this.formData.months || this.formData.months < 1) {
      this.toastService.error('Months must be at least 1', 'Validation Error');
      return false;
    }

    if (!this.formData.label || this.formData.label.trim().length === 0) {
      this.toastService.error('Label is required', 'Validation Error');
      return false;
    }

    const existingOption = this.durationOptions.find(
      opt => opt.months === this.formData.months && 
      (!this.editingOption || opt.id !== this.editingOption.id)
    );

    if (existingOption) {
      this.toastService.error('A duration option with this number of months already exists', 'Validation Error');
      return false;
    }

    return true;
  }

  // ============================================
  // Plans Methods
  // ============================================

  /**
   * Load all subscription plans
   */
  loadPlans(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.tenantService.getPlans()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.plans = response.data;
          } else {
            this.error = response.message || 'Failed to load subscription plans';
          }
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = err.error?.message || 'Failed to load subscription plans';
          this.loading = false;
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
    this.showAddPlanModal = false;
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
    this.cdr.markForCheck();
  }

  openEditPlanModal(plan: SubscriptionPlan): void {
    this.editingPlan = plan;
    this.planFormData = { ...plan };
    this.cdr.markForCheck();
    this.showEditPlanModal = true;
  }

  closeEditPlanModal(): void {
    this.showEditPlanModal = false;
    this.editingPlan = null;
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
    this.cdr.markForCheck();
  }

  openDeletePlanModal(plan: SubscriptionPlan): void {
    this.deletingPlan = plan;
    this.showDeletePlanModal = true;
    this.cdr.markForCheck();
  }

  closeDeletePlanModal(): void {
    this.showDeletePlanModal = false;
    this.deletingPlan = null;
    this.cdr.markForCheck();
  }

  createPlan(): void {
    if (!this.validatePlanForm()) {
      return;
    }

    this.loading = true;
    this.cdr.markForCheck();

    this.tenantService.createPlan(this.planFormData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.success('Subscription plan created successfully', 'Success');
            this.closeAddPlanModal();
            this.loadPlans();
          } else {
            this.toastService.error(response.message || 'Failed to create subscription plan', 'Error');
          }
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.toastService.error(err.error?.message || 'Failed to create subscription plan', 'Error');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  updatePlan(): void {
    if (!this.editingPlan || !this.validatePlanForm()) {
      return;
    }

    this.loading = true;
    this.cdr.markForCheck();

    this.tenantService.updatePlan(this.editingPlan.id!, this.planFormData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.success('Subscription plan updated successfully', 'Success');
            this.closeEditPlanModal();
            this.loadPlans();
          } else {
            this.toastService.error(response.message || 'Failed to update subscription plan', 'Error');
          }
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.toastService.error(err.error?.message || 'Failed to update subscription plan', 'Error');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  deletePlan(): void {
    if (!this.deletingPlan) {
      return;
    }

    this.loading = true;
    this.cdr.markForCheck();

    this.tenantService.deletePlan(this.deletingPlan.id!)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.success('Subscription plan deleted successfully', 'Success');
            this.closeDeletePlanModal();
            this.loadPlans();
          } else {
            this.toastService.error(response.message || 'Failed to delete subscription plan', 'Error');
          }
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.toastService.error(err.error?.message || 'Failed to delete subscription plan', 'Error');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  validatePlanForm(): boolean {
    if (!this.planFormData.key || this.planFormData.key.trim().length === 0) {
      this.toastService.error('Plan key is required', 'Validation Error');
      return false;
    }

    if (!this.planFormData.name || this.planFormData.name.trim().length === 0) {
      this.toastService.error('Plan name is required', 'Validation Error');
      return false;
    }

    if (this.planFormData.price < 0) {
      this.toastService.error('Price cannot be negative', 'Validation Error');
      return false;
    }

    if (this.planFormData.max_users < 1) {
      this.toastService.error('Max users must be at least 1', 'Validation Error');
      return false;
    }

    if (this.planFormData.max_storage_mb < 1) {
      this.toastService.error('Max storage must be at least 1 MB', 'Validation Error');
      return false;
    }

    // Check for duplicate key (excluding current editing plan)
    const existingPlan = this.plans.find(
      p => p.key === this.planFormData.key && 
      (!this.editingPlan || p.id !== this.editingPlan.id)
    );

    if (existingPlan) {
      this.toastService.error('A plan with this key already exists', 'Validation Error');
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

  getStatusBadgeClass(active: boolean): string {
    return active ? 'status-badge status-active' : 'status-badge status-inactive';
  }

  getStatusText(active: boolean): string {
    return active ? 'Active' : 'Inactive';
  }

  /**
   * Navigate back to settings
   */
  goBack(): void {
    this.router.navigate(['/settings']);
  }
}
