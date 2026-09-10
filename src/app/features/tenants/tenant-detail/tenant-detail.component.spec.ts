import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { TenantDetailComponent } from './tenant-detail.component';
import { TenantService } from '@core/services/tenant.service';
import { ToastService } from '@core/services/toast.service';
import { TenantDetailsSnapshot } from '@core/models/tenant.model';

const mockSnapshot: TenantDetailsSnapshot = {
  identity: {
    id: 47,
    name: 'St. Mary Parish',
    slug: 'st-mary',
    logo_url: null,
    logo_full_url: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
  },
  operational: { active: true, active_flag: 1 },
  subscription: {
    status: 'EXPIRED',
    access_mode: 'read_only',
    plan_key: 'basic',
    plan_name: 'Basic Plan',
    subscription_ends_at: '2024-01-01T00:00:00Z',
    max_users: 50,
    max_storage_mb: 1000,
    features: ['donations'],
  },
  modules: [
    {
      key: 'donations',
      label: 'Donation Tracking',
      entitled: true,
      gated: true,
      always_on: false,
      accessible: false,
      access_reason: 'subscription_blocked',
      subscription_status: 'EXPIRED',
      access_mode: 'read_only',
    },
  ],
  contact: {},
  administration: {
    total_users: 5,
    active_users: 4,
    inactive_users: 1,
    remaining_user_slots: 45,
    max_users: 50,
    role_distribution: [{ role: 'Administrator', count: 1 }],
  },
  church: null,
  kpis: {
    users: 5,
    active_users: 4,
    storage_used_mb: 12.5,
    storage_max_mb: 1000,
    last_activity_at: '2024-06-01T00:00:00Z',
  },
  usage: {
    storage: {
      available: true,
      used_mb: 12.5,
      max_storage_mb: 1000,
      remaining_mb: 987.5,
      percent_used: 1.3,
      file_count: 3,
    },
    users: {
      available: true,
      total_users: 5,
      active_users: 4,
      inactive_users: 1,
      frequent_users_30d: 2,
      seen_last_7d: 1,
      never_signed_in: 0,
      last_seen_at: '2024-06-01T00:00:00Z',
      role_distribution: [],
      preview: [],
    },
  },
  users_preview: [],
  history_preview: [],
  warnings: [
    { code: 'subscription_expired', severity: 'warning', message: 'Subscription expired — tenant is currently read-only.' },
  ],
  meta: {
    tenant_id: 47,
    tenant_code: 'st-mary',
    cache_version: 1,
    features: ['donations'],
    generated_at: '2024-06-01T00:00:00Z',
  },
};

describe('TenantDetailComponent', () => {
  let component: TenantDetailComponent;
  let fixture: ComponentFixture<TenantDetailComponent>;
  let tenantService: jest.Mocked<Pick<TenantService, 'getTenantDetails' | 'getSubscriptionPlans' | 'getSubscriptionAudits'>>;

  beforeEach(async () => {
    tenantService = {
      getTenantDetails: jest.fn().mockReturnValue(of({ success: true, data: mockSnapshot })),
      getSubscriptionPlans: jest.fn().mockReturnValue(of({
        success: true,
        data: { basic: { name: 'Basic', price: 29.99, max_users: 50, max_storage_mb: 1000 } },
        duration_options: [{ value: 12, label: '12 months' }],
      })),
      getSubscriptionAudits: jest.fn().mockReturnValue(of({
        success: true,
        data: [],
        pagination: { current_page: 1, last_page: 1, total: 0 },
      })),
    };

    await TestBed.configureTestingModule({
      imports: [TenantDetailComponent],
      providers: [
        { provide: TenantService, useValue: tenantService },
        { provide: ToastService, useValue: { success: jest.fn(), error: jest.fn() } },
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({ id: '47' }),
            queryParams: of({}),
          },
        },
        { provide: Router, useValue: { navigate: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TenantDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads tenant details snapshot on init', () => {
    expect(tenantService.getTenantDetails).toHaveBeenCalledWith(47);
    expect(component.details?.identity.name).toBe('St. Mary Parish');
  });

  it('displays backend subscription status without client calculation', () => {
    expect(component.details?.subscription.status).toBe('EXPIRED');
    expect(component.details?.subscription.access_mode).toBe('read_only');
    expect(component.formatSubscriptionStatus('EXPIRED')).toBe('Expired');
  });

  it('shows module entitlement for expired tenant', () => {
    const donations = component.details?.modules.find(m => m.key === 'donations');
    expect(donations?.entitled).toBe(true);
    expect(component.moduleStatusLabel(donations!)).toBe('Entitled · Blocked');
  });

  it('shows storage KPI when available', () => {
    const storageKpi = component.kpiEntries().find(k => k.label === 'Storage');
    expect(storageKpi?.value).toBe('12.5 / 1000 MB');
  });

  it('handles load error with retry path', () => {
    tenantService.getTenantDetails.mockReturnValueOnce(throwError(() => ({ error: { message: 'Forbidden' } })));
    component.loadDetails();
    expect(component.error).toBeTruthy();
  });

  it('can reload snapshot on demand', () => {
    tenantService.getTenantDetails.mockClear();
    component.loadDetails();
    expect(tenantService.getTenantDetails).toHaveBeenCalledWith(47);
  });
});
