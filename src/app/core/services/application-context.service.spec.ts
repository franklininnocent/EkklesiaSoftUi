import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { ApplicationContextService } from './application-context.service';
import { AuthService } from './auth.service';
import { SupportSessionService } from '@features/support-center/services/support-session.service';

describe('ApplicationContextService', () => {
  let service: ApplicationContextService;
  let authMock: {
    currentUser$: BehaviorSubject<any>;
    currentUserValue: any;
    isPlatformActor: jest.Mock;
  };
  let supportMock: {
    session$: BehaviorSubject<any>;
    isSessionLive: boolean;
    currentSession: any;
  };

  beforeEach(() => {
    authMock = {
      currentUser$: new BehaviorSubject<any>(null),
      currentUserValue: null,
      isPlatformActor: jest.fn(),
    };
    supportMock = {
      session$: new BehaviorSubject<any>(null),
      isSessionLive: false,
      currentSession: null,
    };

    TestBed.configureTestingModule({
      providers: [
        ApplicationContextService,
        { provide: AuthService, useValue: authMock },
        { provide: SupportSessionService, useValue: supportMock },
      ],
    });

    service = TestBed.inject(ApplicationContextService);
  });

  it('tenant user stays TENANT application even with leftover support session', () => {
    const tenantUser = { id: 1, tenant_id: 42, role_name: 'Administrator' };
    authMock.isPlatformActor.mockReturnValue(false);
    supportMock.isSessionLive = true;
    supportMock.currentSession = { tenant_id: 99 };

    expect(service.resolveApplicationMode(tenantUser as any)).toBe('TENANT_MODE');
    expect(service.resolveApplicationContext(tenantUser as any)).toBe('TENANT');
    expect(service.hasSupportTenantContext(tenantUser as any)).toBe(false);
  });

  it('platform admin with session keeps EKKLESIA application and parish resource context for APIs', () => {
    const admin = { id: 2, tenant_id: null, has_ekklesia_role: true, role_name: 'EkklesiaAdmin' };
    authMock.isPlatformActor.mockReturnValue(true);
    supportMock.isSessionLive = true;
    supportMock.currentSession = { tenant_id: 10 };

    expect(service.resolveApplicationMode(admin as any)).toBe('EKKLESIA_MODE');
    expect(service.resolveApplicationContext(admin as any)).toBe('EKKLESIA');
    expect(service.hasParishResourceContext(admin as any)).toBe(true);
    expect(service.hasSupportTenantContext(admin as any)).toBe(true);

    const snapshot = service.resolveNavigationSnapshot(admin as any);
    expect(snapshot.application).toBe('EKKLESIA');
    expect(snapshot.supportActive).toBe(true);
    expect(snapshot.targetTenantId).toBe(10);
    expect(snapshot.actorKind).toBe('platform');
  });

  it('platform admin without session is EKKLESIA application with no support overlay', () => {
    const admin = { id: 2, tenant_id: null, has_ekklesia_role: true, role_name: 'EkklesiaAdmin' };
    authMock.isPlatformActor.mockReturnValue(true);
    supportMock.isSessionLive = false;

    expect(service.resolveApplicationMode(admin as any)).toBe('EKKLESIA_MODE');
    expect(service.hasParishResourceContext(admin as any)).toBe(false);
  });
});
