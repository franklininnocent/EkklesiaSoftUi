import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { Store } from '@ngrx/store';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { MainLayoutComponent } from './main-layout.component';
import { AuthService } from '@core/services/auth.service';
import { NavMenuService } from '@core/services/nav-menu.service';
import { ApplicationContextService } from '@core/services/application-context.service';
import { SubscriptionAccessService } from '@core/services/subscription-access.service';
import { EntitlementService } from '@core/services/entitlement.service';
import { SupportSessionService } from '@features/support-center/services/support-session.service';

describe('MainLayoutComponent (RBAC visibility)', () => {
  let component: MainLayoutComponent;
  let fixture: ComponentFixture<MainLayoutComponent>;
  let authServiceMock: any;
  let navMenuMock: { isVisible: jest.Mock; isRouteAllowed: jest.Mock };
  let userSelection: BehaviorSubject<any>;
  let snapshotSelection: Subject<any>;

  beforeEach(async () => {
    authServiceMock = {
      isAuthenticated: jest.fn().mockReturnValue(false),
      isPlatformActor: jest.fn().mockReturnValue(false),
      isSuperAdmin: jest.fn().mockReturnValue(false),
      isEkklesiaAdmin: jest.fn().mockReturnValue(false),
      isTenantAdmin: jest.fn().mockReturnValue(false),
      canAccessSupportCenter: jest.fn().mockReturnValue(false),
      hasAnyPermission: jest.fn().mockReturnValue(false),
      canAccessRbac: jest.fn().mockReturnValue(false),
      currentUser$: of(null),
      canViewMySubscription: jest.fn().mockReturnValue(false),
    };
    userSelection = new BehaviorSubject<any>(null);
    snapshotSelection = new Subject<any>();
    navMenuMock = {
      isVisible: jest.fn().mockImplementation((id: string, user: any) => {
        if (id === 'tenants') {
          return user?.role_name === 'SuperAdmin' || user?.role_name === 'EkklesiaAdmin';
        }
        if (id === 'roles-permissions') {
          return authServiceMock.canAccessRbac(user);
        }
        return false;
      }),
      isRouteAllowed: jest.fn().mockReturnValue(true),
    };

    await TestBed.configureTestingModule({
      imports: [MainLayoutComponent],
      providers: [
        provideNoopAnimations(),
        {
          provide: Store,
          useValue: {
            select: jest.fn().mockReturnValue(userSelection.asObservable()),
            dispatch: jest.fn()
          }
        },
        provideRouter([]),
        { provide: AuthService, useValue: authServiceMock },
        { provide: NavMenuService, useValue: navMenuMock },
        {
          provide: ApplicationContextService,
          useValue: { hasParishResourceContext: jest.fn().mockReturnValue(false) },
        },
        {
          provide: SupportSessionService,
          useValue: {
            syncWithServer: jest.fn().mockReturnValue(of(null)),
            clearSession: jest.fn(),
            sessionId: null,
            isSessionLive: false,
            session$: of(null),
          },
        },
        {
          provide: SubscriptionAccessService,
          useValue: {
            snapshot$: snapshotSelection.asObservable(),
            ensureLoaded: jest.fn(),
            clear: jest.fn(),
          },
        },
        {
          provide: EntitlementService,
          useValue: {
            entitlements$: of(null),
            load: jest.fn().mockReturnValue(of(null)),
            clear: jest.fn(),
          },
        },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MainLayoutComponent);
    component = fixture.componentInstance;
  });

  it('does not render Display Settings FAB', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.theme-settings-fab')).toBeNull();
    expect(compiled.textContent).not.toContain('Display Settings');
  });

  it('shows tenant management only for platform admins', () => {
    expect(component.canManageTenants({ role_name: 'SuperAdmin' } as any)).toBe(true);
    expect(component.canManageTenants({ role_name: 'EkklesiaAdmin' } as any)).toBe(true);
    expect(component.canManageTenants({ tenant_id: 10, role_name: 'Administrator' } as any)).toBe(false);
  });

  it('shows roles management for tenant admins', () => {
    authServiceMock.canAccessRbac.mockReturnValue(true);
    const user = { tenant_id: 10, role_name: 'Administrator' } as any;

    expect(component.canManageRoles(user)).toBe(true);
    expect(authServiceMock.canAccessRbac).toHaveBeenCalledWith(user);
  });

  it('shows roles management for users with explicit RBAC view permissions', () => {
    authServiceMock.canAccessRbac.mockReturnValue(true);
    const user = { tenant_id: 10, role_name: 'Member' } as any;

    expect(component.canManageRoles(user)).toBe(true);
    expect(authServiceMock.canAccessRbac).toHaveBeenCalledWith(user);
  });

  it('shows Ministries & Associations after subscription access loads', () => {
    let allowMinistries = false;
    navMenuMock.isVisible.mockImplementation((id: string) => {
      if (id === 'ministries') {
        return allowMinistries;
      }
      return id === 'dashboard' || id === 'notifications';
    });

    userSelection.next({ tenant_id: 10, role_name: 'Administrator' });
    fixture.detectChanges();

    const labels = () =>
      component.visibleSidebarSections.flatMap((section) => section.items.map((item) => item.label));

    expect(labels()).not.toContain('Ministries & Associations');

    allowMinistries = true;
    snapshotSelection.next({
      status: 'ACTIVE',
      allows_gated_access: true,
    });
    fixture.detectChanges();

    expect(labels()).toContain('Ministries & Associations');
  });

  it('hides roles management when RBAC access is denied', () => {
    authServiceMock.canAccessRbac.mockReturnValue(false);
    const user = { tenant_id: 10, role_name: 'Member' } as any;

    expect(component.canManageRoles(user)).toBe(false);
    expect(authServiceMock.canAccessRbac).toHaveBeenCalledWith(user);
  });
});
