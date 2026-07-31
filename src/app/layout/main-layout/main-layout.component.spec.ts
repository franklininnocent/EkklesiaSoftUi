import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { MainLayoutComponent } from './main-layout.component';
import { AuthService } from '@core/services/auth.service';
import { ThemeService } from '@core/services/theme.service';

describe('MainLayoutComponent (RBAC visibility)', () => {
  let component: MainLayoutComponent;
  let authServiceMock: any;

  beforeEach(async () => {
    authServiceMock = {
      isAuthenticated: jest.fn().mockReturnValue(false),
      isSuperAdmin: jest.fn().mockReturnValue(false),
      isEkklesiaAdmin: jest.fn().mockReturnValue(false),
      isTenantAdmin: jest.fn().mockReturnValue(false),
      hasAnyPermission: jest.fn().mockReturnValue(false),
      canAccessRbac: jest.fn().mockReturnValue(false)
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
          provide: ThemeService,
          useValue: {
            fontSize$: of('medium'),
            fontSizeOptions: [],
            setFontSize: jest.fn(),
            getCurrentFontSize: jest.fn().mockReturnValue('medium')
          }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(MainLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
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
