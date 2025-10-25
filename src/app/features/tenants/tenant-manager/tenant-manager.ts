/**
 * Tenant Manager Component
 * Displays list of tenants with data from API
 */

import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TenantCreateModalComponent } from '../tenant-create-modal/tenant-create-modal';
import { ConfirmationModalComponent, ConfirmationResult, PaginationComponent } from '@shared/components';
import { TenantService } from '@core/services/tenant.service';
import { ToastService } from '@core/services/toast.service';
import { Tenant } from '@core/models/tenant.model';
import { Subject, takeUntil } from 'rxjs';
import { environment } from '@environments/environment';

@Component({
  selector: 'app-tenant-manager',
  standalone: true,
  imports: [CommonModule, TenantCreateModalComponent, ConfirmationModalComponent, PaginationComponent],
  templateUrl: './tenant-manager.html',
  styleUrls: ['./tenant-manager.scss']
})
export class TenantManagerComponent implements OnInit, OnDestroy {
  private tenantService = inject(TenantService);
  private toastService = inject(ToastService);
  private destroy$ = new Subject<void>();

  showCreateModal = false;
  allTenants: Tenant[] = [];
  tenants: Tenant[] = [];
  loading = false;
  error: string | null = null;

  // Pagination state
  currentPage: number = 1;
  pageSize: number = 20;
  pageSizeOptions: number[] = [10, 20, 50, 100];
  totalTenants: number = 0;

  // Sorting state
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' | null = null;

  // Confirmation modal state
  showConfirmationModal = false;
  confirmationTitle = '';
  confirmationMessage = '';
  confirmButtonClass = '';
  private pendingStatusChange: { tenant: Tenant; newStatus: 0 | 1; checkbox: HTMLInputElement } | null = null;

  ngOnInit(): void {
    this.loadTenants();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load tenants from API
   */
  loadTenants(): void {
    this.loading = true;
    this.error = null;

    this.tenantService.listTenants({ per_page: 'all' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.allTenants = response.data;
            this.totalTenants = response.pagination?.total || response.data.length;
            this.applyFilters();
          }
          this.loading = false;
        },
        error: (err) => {
          this.error = err.message || 'Failed to load tenants';
          this.loading = false;
        }
      });
  }

  /**
   * Apply filters, sorting, and pagination
   */
  applyFilters(): void {
    let filtered = [...this.allTenants];

    // Apply sorting
    if (this.sortColumn && this.sortDirection) {
      filtered = this.applySorting(filtered, this.sortColumn, this.sortDirection);
    }

    // Apply pagination
    this.tenants = this.applyPagination(filtered, this.currentPage, this.pageSize);
  }

  /**
   * Open create modal
   */
  openCreateModal(): void {
    this.showCreateModal = true;
  }

  /**
   * Close create modal
   */
  closeCreateModal(): void {
    this.showCreateModal = false;
  }

  /**
   * Handle tenant created event
   */
  onTenantCreated(): void {
    // The service already updates the tenant list, but we reload to ensure consistency
    this.loadTenants();
    this.closeCreateModal();
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
    return active === 1 ? 'active' : 'inactive';
  }

  /**
   * Format date
   */
  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Get active tenants count
   */
  get activeTenants(): number {
    return this.allTenants.filter(t => t.active === 1).length;
  }

  /**
   * Get total users across all tenants
   */
  get totalUsers(): number {
    // Since API doesn't return user count directly in list, we show tenant count
    // In a real app, this would come from statistics API
    return this.allTenants.length * 15; // Placeholder calculation
  }

  /**
   * Retry loading tenants
   */
  retryLoad(): void {
    this.loadTenants();
  }

  /**
   * Get official address from tenant
   */
  getOfficialAddress(tenant: Tenant): any {
    if (!tenant.addresses || tenant.addresses.length === 0) {
      return null;
    }
    return tenant.addresses.find(addr => addr.address_type === 'official') || null;
  }

  /**
   * Format address for display
   */
  formatAddress(address: any): string {
    if (!address) return '';

    const parts: string[] = [];

    // Add address lines
    if (address.line1) parts.push(address.line1);
    if (address.line2) parts.push(address.line2);

    // Build city/district line
    const locationParts: string[] = [];
    if (address.district) locationParts.push(address.district);
    if (address.city) locationParts.push(address.city);
    if (locationParts.length > 0) {
      parts.push(locationParts.join(', '));
    }

    // Add state and country line
    const regionParts: string[] = [];
    if (address.state_province) regionParts.push(address.state_province);
    if (address.country) regionParts.push(address.country);
    if (address.pin_zip_code) regionParts.push(address.pin_zip_code);
    if (regionParts.length > 0) {
      parts.push(regionParts.join(', '));
    }

    return parts.join('\n');
  }

  /**
   * Get full URL for tenant logo
   * Handles both absolute and relative URLs
   */
  getTenantLogoUrl(logoUrl: string): string {
    if (!logoUrl) return '';
    
    // If it's already an absolute URL (starts with http:// or https://), return as-is
    if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
      return logoUrl;
    }
    
    // Otherwise, construct URL from backend base URL
    const baseUrl = environment.apiUrl.replace('/api', '');
    
    // Remove leading slash from logoUrl if present to avoid double slashes
    const cleanLogoUrl = logoUrl.startsWith('/') ? logoUrl.substring(1) : logoUrl;
    
    return `${baseUrl}/${cleanLogoUrl}`;
  }

  /**
   * Handle logo image load error - fallback to default icon
   */
  onLogoError(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    // Hide the image and let the default icon show
    if (imgElement && imgElement.parentElement) {
      imgElement.style.display = 'none';
      
      // Create and insert default icon if not already present
      const parent = imgElement.parentElement;
      if (!parent.querySelector('.tenant-icon-default')) {
        const defaultIcon = document.createElement('div');
        defaultIcon.className = 'tenant-icon-default';
        defaultIcon.textContent = '🏢';
        parent.appendChild(defaultIcon);
      }
    }
  }

  /**
   * Toggle tenant active status - Shows confirmation modal first
   */
  toggleTenantStatus(tenant: Tenant, event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    const newStatus = checkbox.checked ? 1 : 0;
    
    // Prevent multiple simultaneous toggles
    if (tenant.isTogglingStatus) {
      checkbox.checked = tenant.active === 1;
      return;
    }

    // Store pending change
    this.pendingStatusChange = { tenant, newStatus, checkbox };

    // Configure confirmation modal based on action
    if (newStatus === 1) {
      this.confirmationTitle = 'Activate Tenant';
      this.confirmationMessage = `Are you sure you want to activate "${tenant.name}"? This will enable all services for this tenant.`;
      this.confirmButtonClass = 'btn-success';
    } else {
      this.confirmationTitle = 'Deactivate Tenant';
      this.confirmationMessage = `Are you sure you want to deactivate "${tenant.name}"? This will disable all services for this tenant.`;
      this.confirmButtonClass = 'btn-danger';
    }

    // Show confirmation modal
    this.showConfirmationModal = true;
  }

  /**
   * Handle confirmation modal result
   */
  onConfirmStatusChange(result: ConfirmationResult): void {
    this.showConfirmationModal = false;

    if (!result.confirmed || !this.pendingStatusChange) {
      // User cancelled - revert checkbox
      if (this.pendingStatusChange) {
        this.pendingStatusChange.checkbox.checked = this.pendingStatusChange.tenant.active === 1;
      }
      this.pendingStatusChange = null;
      return;
    }

    const { tenant, newStatus, checkbox } = this.pendingStatusChange;
    const statusText = newStatus === 1 ? 'activated' : 'deactivated';
    const description = result.description;

    // Set loading state
    tenant.isTogglingStatus = true;

    this.tenantService.updateTenantStatus(tenant.id, newStatus, description)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            // Update local tenant object
            tenant.active = newStatus;
            
            // Show success toast
            this.toastService.success(
              `${tenant.name} has been ${statusText} successfully`,
              'Status Updated'
            );
            
            console.log(`Tenant ${tenant.name} status updated to ${statusText}`, {
              description: description || 'No description provided'
            });
          } else {
            // Revert checkbox on failure
            checkbox.checked = tenant.active === 1;
            
            // Show error toast
            this.toastService.error(
              response.message || 'Failed to update tenant status',
              'Update Failed'
            );
            
            this.error = response.message || 'Failed to update tenant status';
          }
          tenant.isTogglingStatus = false;
          this.pendingStatusChange = null;
        },
        error: (err) => {
          // Revert checkbox on error
          checkbox.checked = tenant.active === 1;
          
          // Show error toast
          const errorMessage = err.error?.message || 'Failed to update tenant status. Please try again.';
          this.toastService.error(errorMessage, 'Error');
          
          this.error = errorMessage;
          tenant.isTogglingStatus = false;
          this.pendingStatusChange = null;
          console.error('Error updating tenant status:', err);
        }
      });
  }

  /**
   * Handle confirmation modal cancellation
   */
  onCancelStatusChange(): void {
    this.showConfirmationModal = false;
    
    // Revert checkbox
    if (this.pendingStatusChange) {
      this.pendingStatusChange.checkbox.checked = this.pendingStatusChange.tenant.active === 1;
      this.pendingStatusChange = null;
    }
  }

  /**
   * Pagination event handlers
   */
  onPageChange(page: number): void {
    this.currentPage = page;
    this.applyFilters();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 1; // Reset to first page
    this.applyFilters();
  }

  /**
   * Helper methods for pagination
   */
  private applyPagination(data: Tenant[], page: number, pageSize: number): Tenant[] {
    const startIndex = (page - 1) * pageSize;
    return data.slice(startIndex, startIndex + pageSize);
  }

  private applySorting(data: Tenant[], column: string, direction: 'asc' | 'desc'): Tenant[] {
    // Sorting not currently used in grid view, but kept for future enhancement
    return data;
  }
}
