import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Router } from '@angular/router';

import { TenantManagerComponent } from './tenant-manager';
import { TenantService } from '@core/services/tenant.service';
import { ToastService } from '@core/services/toast.service';
import { AuthService } from '@core/services/auth.service';
import { DioceseService } from '@core/services/ecclesiastical/diocese.service';

describe('TenantManagerComponent', () => {
  let component: TenantManagerComponent;
  let fixture: ComponentFixture<TenantManagerComponent>;
  let tenantService: jest.Mocked<Pick<TenantService, 'listTenants' | 'getStatistics'>>;

  const mockTenants = Array.from({ length: 20 }).map((_, i) => ({
    id: i + 1,
    name: `Tenant ${i + 1}`,
    slug: `tenant-${i + 1}`,
    active: i < 16 ? 1 : 0,
    created_at: '2024-01-01T00:00:00Z',
    plan: 'basic',
    max_users: 100,
    tenant_tier: 'parish',
    active_users_count: 12 + i,
    users_count: 15 + i,
  })) as any[];

  beforeEach(async () => {
    tenantService = {
      listTenants: jest.fn().mockImplementation((params?: { page?: number; per_page?: number }) =>
        of({
          success: true,
          data: mockTenants,
          pagination: {
            current_page: params?.page ?? 1,
            last_page: 4,
            per_page: params?.per_page ?? 20,
            total: 75,
            from: 1,
            to: 20,
          },
        })
      ),
      getStatistics: jest.fn().mockReturnValue(
        of({
          success: true,
          data: {
            total_tenants: 75,
            active_tenants: 64,
            inactive_tenants: 11,
            tenants_by_plan: { free: 0, basic: 75, premium: 0, enterprise: 0 },
            in_trial: 5,
            subscribed: 60,
            recent_tenants: [],
          },
        })
      ),
    };

    await TestBed.configureTestingModule({
      imports: [TenantManagerComponent],
      providers: [
        { provide: TenantService, useValue: tenantService },
        { provide: ToastService, useValue: { success: () => {}, error: () => {} } },
        { provide: AuthService, useValue: { isAuthenticated: () => true, currentUser: {} } },
        {
          provide: DioceseService,
          useValue: {
            getArchdioceses: jest.fn().mockReturnValue(of({ success: true, data: [{ id: 1, name: 'Test Diocese' }] })),
          },
        },
        { provide: Router, useValue: { navigate: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TenantManagerComponent);
    component = fixture.componentInstance;
  });

  it('loads tenants with server-side pagination metadata', () => {
    component.loadTenants();

    expect(component.loading()).toBe(false);
    expect(component.error()).toBeNull();
    expect(component.tenants().length).toBe(20);
    expect(component.filteredTotal()).toBe(75);
    expect(tenantService.listTenants).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, per_page: 20 })
    );
  });

  it('loads statistics for inline summary badges', () => {
    component.ngOnInit();

    expect(component.totalTenants()).toBe(75);
    expect(component.activeTenants()).toBe(64);
    expect(component.inTrialTenants()).toBe(5);
    expect(component.suspendedTenants()).toBe(11);
  });

  it('defaults to card view', () => {
    expect(component.currentView()).toBe('card');
  });

  it('switches between table and card views', () => {
    component.setView('card');
    expect(component.currentView()).toBe('card');
    component.setView('table');
    expect(component.currentView()).toBe('table');
  });

  it('passes search term to the API and resets pagination', () => {
    component.onListSearchChange('Alpha Parish');
    component.loadTenants();

    expect(tenantService.listTenants).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'Alpha Parish', page: 1 })
    );
  });

  it('clears search on escape when search term is set', () => {
    component.onListSearchChange('Alpha');
    const loadSpy = jest.spyOn(component, 'loadTenants').mockImplementation(() => {});
    component.onEscapeKey();

    expect(component.searchTerm()).toBe('');
    expect(loadSpy).toHaveBeenCalled();
  });

  it('applies drawer filters and closes the panel', () => {
    component.onAdvancedSearch({
      active: '1',
      plan: 'premium',
      tenant_tier: 'parish',
      archdiocese_id: '1',
      subscription_status: 'trial',
    });

    expect(component.showAdvancedSearch()).toBe(false);
    expect(tenantService.listTenants).toHaveBeenCalledWith(
      expect.objectContaining({
        active: 1,
        plan: 'premium',
        tenant_tier: 'parish',
        archdiocese_id: 1,
        subscription_status: 'trial',
        page: 1,
      })
    );
    expect(component.getActiveFilterCount()).toBe(5);
  });

  it('clears filters and reloads tenants', () => {
    component.onAdvancedSearch({ active: '1', plan: 'basic' });
    component.onClearAdvancedSearch();

    expect(component.getActiveFilterCount()).toBe(0);
    expect(tenantService.listTenants).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ active: 1, plan: 'basic' })
    );
  });

  it('removes a single active filter chip', () => {
    component.onAdvancedSearch({ active: '1', plan: 'basic' });
    const planFilter = component.getActiveFilters().find((filter) => filter.key === 'plan');
    component.removeFilter(planFilter!);

    expect(component.getActiveFilterCount()).toBe(1);
    expect(tenantService.listTenants).toHaveBeenLastCalledWith(
      expect.objectContaining({ active: 1, page: 1 })
    );
  });

  it('onPageChange requests the selected page from the API', () => {
    component.loadTenants();
    component.onPageChange(3);

    expect(component.currentPage()).toBe(3);
    expect(tenantService.listTenants).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 3, per_page: 20 })
    );
  });

  it('onPageSizeChange resets to page 1 and updates per_page', () => {
    component.loadTenants();
    component.onPageChange(3);
    component.onPageSizeChange(50);

    expect(component.currentPage()).toBe(1);
    expect(component.pageSize()).toBe(50);
    expect(tenantService.listTenants).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, per_page: 50 })
    );
  });

  it('toggles tenant row selection', () => {
    component.loadTenants();
    component.toggleTenantSelection(1, true);
    expect(component.isTenantSelected(1)).toBe(true);
    component.toggleSelectAll(true);
    expect(component.allSelected()).toBe(true);
    component.toggleSelectAll(false);
    expect(component.selectedTenantIds().size).toBe(0);
  });

  it('formats active user count with max_users limit', () => {
    expect(component.getActiveUserCount(mockTenants[0])).toBe('12/100');
    expect(component.getActiveUserCount({ ...mockTenants[0], active_users_count: undefined, users_count: undefined, max_users: 50 })).toBe('0/50');
  });

  it('formats plan expiry from subscription or trial end date', () => {
    const subscribed = {
      ...mockTenants[0],
      trial_ends_at: null,
      subscription_ends_at: '2026-12-15T00:00:00Z',
    };
    const trialing = {
      ...mockTenants[0],
      trial_ends_at: '2027-06-01T00:00:00Z',
      subscription_ends_at: '2026-12-15T00:00:00Z',
    };
    const lifetime = { ...mockTenants[0], trial_ends_at: null, subscription_ends_at: null };

    expect(component.formatPlanExpiry(subscribed)).toBe('Dec 15, 2026');
    expect(component.getPlanExpiryLabel(subscribed)).toBe('Expires');
    expect(component.formatPlanExpiry(trialing)).toBe('Jun 1, 2027');
    expect(component.getPlanExpiryLabel(trialing)).toBe('Trial ends');
    expect(component.formatPlanExpiry(lifetime)).toBe('No expiry');
  });

  it('derives status and health labels from tenant state', () => {
    const activeTenant = { ...mockTenants[0], active: 1, subscription_suspended_at: null };
    const subscribedTenant = { ...mockTenants[0], active: 1, subscription_status: 'ACTIVE' };
    const expiredTenant = {
      ...mockTenants[0],
      active: 1,
      subscription_status: 'EXPIRED',
      subscription_ends_at: '2026-08-31T00:00:00Z',
    };
    const suspendedTenant = { ...mockTenants[0], active: 0, subscription_suspended_at: '2024-06-01' };

    expect(component.getStatusLabel(activeTenant)).toBe('Active');
    expect(component.getStatusTone(activeTenant)).toBe('success');
    expect(component.getStatusLabel(subscribedTenant)).toBe('Active');
    expect(component.getStatusLabel(expiredTenant)).toBe('Expired (read-only)');
    expect(component.getStatusTone(expiredTenant)).toBe('critical');
    expect(component.getHealthLabel(expiredTenant)).toBe('At risk');
    expect(component.getHealthTone(expiredTenant)).toBe('risk');
    expect(component.getHealthLabel(suspendedTenant)).toBe('At risk');
    expect(component.getHealthTone(suspendedTenant)).toBe('risk');
  });

  it('renders compact toolbar, card view by default, and result count', () => {
    component.onAdvancedSearch({ active: '1' });
    component.loadTenants();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.cf-list-toolbar__search')).toBeTruthy();
    expect(compiled.querySelector('.tenant-manager__view-toggle')).toBeTruthy();
    expect(compiled.textContent).toContain('75 tenants found');
    expect(compiled.querySelectorAll('.tenant-manager__card').length).toBe(20);
  });

  it('renders table when table view is selected', () => {
    component.loadTenants();
    component.setView('table');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.cf-table tbody tr')).toBeTruthy();
    expect(compiled.querySelectorAll('th.sortable').length).toBe(5);
  });

  it('sorts tenant list via API when a column header is clicked', () => {
    component.loadTenants();
    component.setView('table');

    component.onSort({ column: 'name', direction: 'asc' });

    expect(component.sortColumn).toBe('name');
    expect(component.sortDirection).toBe('asc');
    expect(tenantService.listTenants).toHaveBeenCalledWith(
      expect.objectContaining({
        sort_by: 'name',
        sort_order: 'asc',
        page: 1,
      })
    );
  });

  it('sets error on load failure', () => {
    tenantService.listTenants.mockReturnValue(throwError(() => ({ message: 'boom' })));

    component.loadTenants();

    expect(component.loading()).toBe(false);
    expect(component.error()).toBe('boom');
  });

  it('retryLoad triggers loadTenants', () => {
    const spy = jest.spyOn(component, 'loadTenants').mockImplementation(() => {});
    component.retryLoad();
    expect(spy).toHaveBeenCalled();
  });

  it('open/close modal toggles flag', () => {
    component.openCreateModal();
    expect(component.showCreateModal()).toBe(true);
    component.closeCreateModal();
    expect(component.showCreateModal()).toBe(false);
  });
});
