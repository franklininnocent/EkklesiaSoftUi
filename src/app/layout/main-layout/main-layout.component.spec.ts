import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { MainLayoutComponent } from './main-layout.component';
import { AuthService } from '@core/services/auth.service';
import { SubscriptionAccessService } from '@core/services/subscription-access.service';

describe('MainLayoutComponent (RBAC visibility)', () => {
  let component: MainLayoutComponent;
  let fixture: ComponentFixture<MainLayoutComponent>;
  let authServiceMock: any;

  beforeEach(async () => {
    authServiceMock = {
      isAuthenticated: jest.fn().mockReturnValue(false),
      isSuperAdmin: jest.fn().mockReturnValue(false),
      isEkklesiaAdmin: jest.fn().mockReturnValue(false),
      isTenantAdmin: jest.fn().mockReturnValue(false),
      hasAnyPermission: jest.fn().mockReturnValue(false),
      canAccessRbac: jest.fn().mockReturnValue(false),
      canAccessBcc: jest.fn().mockReturnValue(false),
      canAccessSupport: jest.fn().mockReturnValue(false),
      canAccessDonations: jest.fn().mockReturnValue(false),
      canAccessMinistries: jest.fn().mockReturnValue(false),
      currentUser$: of(null),
      canViewMySubscription: jest.fn().mockReturnValue(false),
    };

    await TestBed.configureTestingModule({
      imports: [MainLayoutComponent],
      providers: [
        provideNoopAnimations(),
        {
          provide: Store,
          useValue: {
            select: jest.fn().mockReturnValue(of(null)),
            dispatch: jest.fn()
          }
        },
        provideRouter([]),
        { provide: AuthService, useValue: authServiceMock },
        {
          provide: SubscriptionAccessService,
          useValue: {
            snapshot$: of(null),
            ensureLoaded: jest.fn(),
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

  it('hides roles management when RBAC access is denied', () => {
    authServiceMock.canAccessRbac.mockReturnValue(false);
    const user = { tenant_id: 10, role_name: 'Member' } as any;

    expect(component.canManageRoles(user)).toBe(false);
    expect(authServiceMock.canAccessRbac).toHaveBeenCalledWith(user);
  });
});
