/**
 * Tenant Manager Component
 * Displays list of tenants with data from API
 */

import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TenantCreateModalComponent } from '../tenant-create-modal/tenant-create-modal';
import { TenantService } from '@core/services/tenant.service';
import { Tenant } from '@core/models/tenant.model';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-tenant-manager',
  standalone: true,
  imports: [CommonModule, TenantCreateModalComponent],
  templateUrl: './tenant-manager.html',
  styleUrls: ['./tenant-manager.scss']
})
export class TenantManagerComponent implements OnInit, OnDestroy {
  private tenantService = inject(TenantService);
  private destroy$ = new Subject<void>();

  showCreateModal = false;
  tenants: Tenant[] = [];
  loading = false;
  error: string | null = null;

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

    this.tenantService.listTenants({ per_page: 50, sort_by: 'created_at', sort_order: 'desc' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.tenants = response.data;
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
   * Get total tenants count
   */
  get totalTenants(): number {
    return this.tenants.length;
  }

  /**
   * Get active tenants count
   */
  get activeTenants(): number {
    return this.tenants.filter(t => t.active === 1).length;
  }

  /**
   * Get total users across all tenants
   */
  get totalUsers(): number {
    // Since API doesn't return user count directly in list, we show tenant count
    // In a real app, this would come from statistics API
    return this.tenants.length * 15; // Placeholder calculation
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
}
