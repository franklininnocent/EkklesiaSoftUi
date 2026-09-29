import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { SubscriptionAccessService } from '@core/services/subscription-access.service';
import { FEATURE_UNAVAILABLE_PATH } from '@core/guards/entitlement.guard';
import { MassIntentionsApiService } from '@features/mass-intentions/services/mass-intentions-api.service';
import { SupportSessionService } from '@features/support-center/services/support-session.service';
import { massIntentionsGuard } from './mass-intentions.guard';

describe('massIntentionsGuard', () => {
  const navigate = jest.fn();
  let auth: {
    isAuthenticated: jest.Mock;
    currentUserValue: any;
    canAccessMassIntentions: jest.Mock;
    isPlatformActor: jest.Mock;
    isSuperAdmin: jest.Mock;
    isEkklesiaAdmin: jest.Mock;
    canViewMySubscription: jest.Mock;
  };
  let getModuleStatus: jest.Mock;

  beforeEach(() => {
    navigate.mockReset();
    getModuleStatus = jest.fn(() => of({ success: true, data: { enabled: true } }));
    auth = {
      isAuthenticated: jest.fn(() => true),
      currentUserValue: { id: 1, tenant_id: 9, role_name: 'Administrator' },
      canAccessMassIntentions: jest.fn(() => true),
      isPlatformActor: jest.fn(() => false),
      isSuperAdmin: jest.fn(() => false),
      isEkklesiaAdmin: jest.fn(() => false),
      canViewMySubscription: jest.fn(() => false),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        {
          provide: SubscriptionAccessService,
          useValue: {
            ensureLoaded: jest.fn(),
            refresh: jest.fn(() => of(null)),
            canViewGatedModules: jest.fn(() => true),
            snapshot: null,
          },
        },
        { provide: MassIntentionsApiService, useValue: { getModuleStatus } },
        { provide: SupportSessionService, useValue: { sessionId: null } },
        { provide: Router, useValue: { navigate } },
        {
          provide: Store,
          useValue: {
            dispatch: jest.fn(),
            select: jest.fn(() => of(auth.currentUserValue)),
          },
        },
      ],
    });
  });

  it('does not send a parish user to the tenant dashboard when the module is disabled', (done) => {
    getModuleStatus.mockReturnValue(of({ success: true, data: { enabled: false } }));

    TestBed.runInInjectionContext(() => {
      const result$ = massIntentionsGuard({} as any, { url: '/mass-intentions' } as any);
      (result$ as any).subscribe((allowed: boolean) => {
        expect(allowed).toBe(false);
        expect(navigate).toHaveBeenCalledWith(
          [FEATURE_UNAVAILABLE_PATH],
          expect.objectContaining({ queryParams: { feature: 'MASS_INTENTIONS' } })
        );
        expect(navigate).not.toHaveBeenCalledWith(
          ['/dashboard'],
          expect.anything()
        );
        done();
      });
    });
  });

  it('allows an authorized tenant user when the module is enabled', (done) => {
    TestBed.runInInjectionContext(() => {
      const result$ = massIntentionsGuard({} as any, { url: '/mass-intentions' } as any);
      (result$ as any).subscribe((allowed: boolean) => {
        expect(allowed).toBe(true);
        expect(navigate).not.toHaveBeenCalled();
        done();
      });
    });
  });
});
