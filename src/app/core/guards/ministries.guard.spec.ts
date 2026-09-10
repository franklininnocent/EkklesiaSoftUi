import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { SubscriptionAccessService } from '@core/services/subscription-access.service';
import { SupportSessionService } from '@features/support-center/services/support-session.service';
import { ministriesGuard } from './ministries.guard';

describe('ministriesGuard', () => {
  const navigate = jest.fn();
  let auth: {
    isAuthenticated: jest.Mock;
    currentUserValue: any;
    canAccessMinistries: jest.Mock;
    isSuperAdmin: jest.Mock;
    isEkklesiaAdmin: jest.Mock;
    canViewMySubscription: jest.Mock;
  };
  let supportSessionId: string | null;

  beforeEach(() => {
    navigate.mockReset();
    supportSessionId = null;
    auth = {
      isAuthenticated: jest.fn(() => true),
      currentUserValue: null,
      canAccessMinistries: jest.fn(() => false),
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
            allowsGatedAccess: true,
            canViewGatedModules: jest.fn(() => true),
            snapshot: null,
          },
        },
        {
          provide: SupportSessionService,
          useValue: {
            get sessionId() {
              return supportSessionId;
            },
          },
        },
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

  it('redirects EkklesiaAdmin without tenant context to Ministries Insights', (done) => {
    auth.currentUserValue = { id: 1, tenant_id: null, role_name: 'EkklesiaAdmin' };
    auth.isEkklesiaAdmin.mockReturnValue(true);
    auth.canAccessMinistries.mockReturnValue(false);

    TestBed.runInInjectionContext(() => {
      const result$ = ministriesGuard({} as any, { url: '/ministries' } as any);
      if (typeof result$ === 'boolean') {
        expect(result$).toBe(false);
        done();
        return;
      }
      (result$ as any).subscribe((allowed: boolean) => {
        expect(allowed).toBe(false);
        expect(navigate).toHaveBeenCalledWith(
          ['/platform/ministries'],
          expect.objectContaining({
            queryParams: expect.objectContaining({ notice: 'tenant_context_required' }),
          })
        );
        done();
      });
    });
  });

  it('allows EkklesiaAdmin when a support session is active', (done) => {
    auth.currentUserValue = { id: 1, tenant_id: null, role_name: 'EkklesiaAdmin' };
    auth.isEkklesiaAdmin.mockReturnValue(true);
    auth.canAccessMinistries.mockReturnValue(true);
    supportSessionId = 'sess-1';

    TestBed.runInInjectionContext(() => {
      const result$ = ministriesGuard({} as any, { url: '/ministries' } as any);
      (result$ as any).subscribe((allowed: boolean) => {
        expect(allowed).toBe(true);
        expect(navigate).not.toHaveBeenCalled();
        done();
      });
    });
  });
});
