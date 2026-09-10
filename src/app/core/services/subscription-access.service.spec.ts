import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { SubscriptionAccessService } from './subscription-access.service';
import { TenantService } from './tenant.service';
import { AuthService } from './auth.service';

describe('SubscriptionAccessService', () => {
  let service: SubscriptionAccessService;
  let tenantService: { getSubscriptionAccess: jest.Mock };
  let authService: { currentUserValue: { tenant_id: number } | null };

  beforeEach(() => {
    tenantService = {
      getSubscriptionAccess: jest.fn(() =>
        of({
          success: true,
          data: {
            status: 'EXPIRED',
            access_mode: 'read_only',
            is_read_only: true,
            allows_gated_access: true,
          },
        })
      ),
    };
    authService = { currentUserValue: { tenant_id: 42 } };

    TestBed.configureTestingModule({
      providers: [
        SubscriptionAccessService,
        { provide: TenantService, useValue: tenantService },
        { provide: AuthService, useValue: authService },
      ],
    });

    service = TestBed.inject(SubscriptionAccessService);
  });

  it('marks tenant as read-only from snapshot', () => {
    service.refresh().subscribe();
    expect(service.isReadOnly()).toBe(true);
    expect(service.canViewGatedModules()).toBe(true);
  });

  it('fail-closes writes when snapshot is missing for tenant user', () => {
    tenantService.getSubscriptionAccess.mockReturnValue(throwError(() => new Error('network')));
    service.refresh().subscribe();
    expect(service.isReadOnly()).toBe(true);
  });
});
