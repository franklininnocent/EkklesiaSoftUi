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
import { Subject, takeUntil } from 'rxjs';
import { environment } from '@environments/environment';

@Component({
  selector: 'app-tenant-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  ngOnInit(): void {
    this.route.params
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        this.tenantId = +params['id'];
        if (this.tenantId) {
          this.loadTenant();
          this.loadSubscriptionPlans();
        }
      });

    // Check for tab query parameter to set active tab
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(queryParams => {
        if (queryParams['tab'] && ['details', 'subscription', 'actions'].includes(queryParams['tab'])) {
          this.activeTab = queryParams['tab'] as 'details' | 'subscription' | 'actions';
          this.cdr.markForCheck();
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
    this.cdr.markForCheck();
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
    this.tenantService.getSubscriptionPlans()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.availablePlans = response.data;
            // Get currency from response if available
            if ((response as any).currency) {
              this.currency = (response as any).currency;
            }
            // Get duration options from response if available
            if ((response as any).duration_options) {
              this.durationOptions = (response as any).duration_options;
              // Set default duration to first option or 12 months
              if (this.durationOptions.length > 0) {
                const defaultOption = this.durationOptions.find(opt => opt.value === 12) || this.durationOptions[0];
                this.subscriptionDuration = defaultOption.value;
              }
            }
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error loading subscription plans:', err);
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
    this.showUpgradeModal = true;
    this.cdr.markForCheck();
  }

  /**
   * Close upgrade modal
   */
  closeUpgradeModal(): void {
    this.showUpgradeModal = false;
    this.selectedPlan = '';
    this.loading = false; // Ensure loading state is reset when modal closes
    this.cdr.markForCheck();
  }

  /**
   * Upgrade subscription (or switch to Free plan)
   */
  upgradeSubscription(): void {
    if (!this.tenantId || !this.selectedPlan) return;

    // Allow upgrades or downgrades to Free plan (for grace periods/exceptions)
    const planOrder = ['free', 'basic', 'premium', 'enterprise'];
    const currentPlanIndex = planOrder.indexOf(this.tenant?.plan || 'free');
    const newPlanIndex = planOrder.indexOf(this.selectedPlan);

    // Only prevent downgrades to non-Free plans
    if (newPlanIndex < currentPlanIndex && this.selectedPlan !== 'free') {
      this.toastService.error('Only downgrades to Free plan are allowed for special cases', 'Invalid Selection');
      return;
    }

    this.loading = true;
    this.cdr.markForCheck();

    this.tenantService.upgradeSubscription(this.tenantId, this.selectedPlan, this.subscriptionDuration)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            // Backend returns data.tenant for upgrade response
            const responseData = response.data as any;
            this.tenant = responseData?.tenant || response.data;
            this.closeUpgradeModal();
            this.toastService.success('Subscription upgraded successfully', 'Success');
          } else {
            this.toastService.error(response.message || 'Failed to upgrade subscription', 'Error');
          }
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.toastService.error(err.error?.message || 'Failed to upgrade subscription', 'Error');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Open renew modal
   */
  openRenewModal(): void {
    this.showRenewModal = true;
    // Set default duration to 12 months (1 year) if available, otherwise first option
    if (this.durationOptions.length > 0) {
      const defaultOption = this.durationOptions.find(opt => opt.value === 12) || this.durationOptions[0];
      this.subscriptionDuration = defaultOption.value;
    } else {
      this.subscriptionDuration = 12;
    }
    this.cdr.markForCheck();
  }

  /**
   * Close renew modal
   */
  closeRenewModal(): void {
    this.showRenewModal = false;
    this.subscriptionDuration = 12;
    this.loading = false; // Ensure loading state is reset when modal closes
    this.cdr.markForCheck();
  }

  /**
   * Renew subscription
   */
  renewSubscription(): void {
    if (!this.tenantId) return;

    this.loading = true;
    this.cdr.markForCheck();

    this.tenantService.renewSubscription(this.tenantId, this.subscriptionDuration)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.loading = false;
            this.cdr.markForCheck();
            this.toastService.success('Subscription renewed successfully', 'Success');
            this.closeRenewModal();
            // Refresh tenant data to show updated subscription information
            this.loadTenant();
            // Ensure subscription tab is active
            this.activeTab = 'subscription';
            this.cdr.markForCheck();
          } else {
            this.toastService.error(response.message || 'Failed to renew subscription', 'Error');
            this.loading = false;
            this.cdr.markForCheck();
          }
        },
        error: (err) => {
          this.toastService.error(err.error?.message || 'Failed to renew subscription', 'Error');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
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
   * Check if plan is available for upgrade
   */
  canUpgradeTo(planKey: string): boolean {
    if (!this.tenant) return false;
    
    const planOrder = ['free', 'basic', 'premium', 'enterprise'];
    const currentIndex = planOrder.indexOf(this.tenant.plan);
    const targetIndex = planOrder.indexOf(planKey);
    
    // Allow upgrades (higher plans) and downgrades to Free plan (for grace periods/exceptions)
    return targetIndex > currentIndex || planKey === 'free';
  }

  /**
   * Check if a plan can be selected (upgrade, downgrade to Free, or current plan)
   */
  canSelectPlan(planKey: string): boolean {
    if (!this.tenant) return false;
    
    // Always allow selecting current plan
    if (this.tenant.plan === planKey) return true;
    
    // Allow upgrades (higher plans) or downgrades to Free plan
    return this.canUpgradeTo(planKey);
  }

  /**
   * Get available plans for upgrade
   */
  getAvailablePlans(): string[] {
    return Object.keys(this.availablePlans);
  }

  /**
   * Calculate new end date for renewal
   */
  getNewEndDate(currentEndDate: string | null, months: number): string {
    if (!currentEndDate) {
      const newDate = new Date();
      newDate.setMonth(newDate.getMonth() + months);
      return this.formatDate(newDate.toISOString());
    }
    
    const current = new Date(currentEndDate);
    const isExpired = current < new Date();
    
    if (isExpired) {
      const newDate = new Date();
      newDate.setMonth(newDate.getMonth() + months);
      return this.formatDate(newDate.toISOString());
    } else {
      current.setMonth(current.getMonth() + months);
      return this.formatDate(current.toISOString());
    }
  }
}

