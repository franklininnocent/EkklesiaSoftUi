import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, firstValueFrom } from 'rxjs';
import { rbacGuard } from './rbac.guard';
import { AuthService } from '@core/services/auth.service';

describe('rbacGuard', () => {
  let routerNavigateSpy: jest.SpyInstance;
  let authServiceMock: {
    currentUser$: any;
    canAccessRbac: jest.Mock<boolean, [any]>;
  };

  beforeEach(() => {
    const routerSpy = {
      navigate: jest.fn()
    } as unknown as Router;

    authServiceMock = {
      currentUser$: of(null),
      canAccessRbac: jest.fn().mockReturnValue(false)
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: routerSpy },
        { provide: AuthService, useValue: authServiceMock }
      ]
    });

    const router = TestBed.inject(Router);
    routerNavigateSpy = jest.spyOn(router, 'navigate');
  });

  it('redirects to login when user is missing', async () => {
    authServiceMock.currentUser$ = of(null);

    const result$ = TestBed.runInInjectionContext(
      () => rbacGuard({} as any, { url: '/settings/roles-permissions' } as any)
    ) as any;

    await expect(firstValueFrom(result$)).resolves.toBe(false);
    expect(routerNavigateSpy).toHaveBeenCalledWith(
      ['/auth/login'],
      { queryParams: { returnUrl: '/settings/roles-permissions' } }
    );
  });

  it('allows platform admin users', async () => {
    const user = { id: 1, tenant_id: null } as any;
    authServiceMock.currentUser$ = of(user);
    authServiceMock.canAccessRbac.mockImplementation((arg: any) => arg === user);

    const result$ = TestBed.runInInjectionContext(
      () => rbacGuard({} as any, { url: '/settings/roles-permissions' } as any)
    ) as any;

    await expect(firstValueFrom(result$)).resolves.toBe(true);
    expect(authServiceMock.canAccessRbac).toHaveBeenCalledWith(user);
    expect(routerNavigateSpy).not.toHaveBeenCalled();
  });

  it('allows tenant admin with view permission', async () => {
    const user = { id: 2, tenant_id: 44 } as any;
    authServiceMock.currentUser$ = of(user);
    authServiceMock.canAccessRbac.mockImplementation((arg: any) => arg === user);

    const result$ = TestBed.runInInjectionContext(
      () => rbacGuard({} as any, { url: '/settings/roles-permissions' } as any)
    ) as any;

    await expect(firstValueFrom(result$)).resolves.toBe(true);
    expect(authServiceMock.canAccessRbac).toHaveBeenCalledWith(user);
    expect(routerNavigateSpy).not.toHaveBeenCalled();
  });

  it('allows tenant admin without explicit view permission', async () => {
    const user = { id: 3, tenant_id: 44 } as any;
    authServiceMock.currentUser$ = of(user);
    authServiceMock.canAccessRbac.mockImplementation((arg: any) => arg === user);

    const result$ = TestBed.runInInjectionContext(
      () => rbacGuard({} as any, { url: '/settings/roles-permissions' } as any)
    ) as any;

    await expect(firstValueFrom(result$)).resolves.toBe(true);
    expect(authServiceMock.canAccessRbac).toHaveBeenCalledWith(user);
    expect(routerNavigateSpy).not.toHaveBeenCalled();
  });

  it('allows Church Administrator role even without explicit permission payload', async () => {
    const user = { id: 4, tenant_id: 55 } as any;
    authServiceMock.currentUser$ = of(user);
    authServiceMock.canAccessRbac.mockImplementation((arg: any) => arg === user);

    const result$ = TestBed.runInInjectionContext(
      () => rbacGuard({} as any, { url: '/settings/roles-permissions' } as any)
    ) as any;

    await expect(firstValueFrom(result$)).resolves.toBe(true);
    expect(authServiceMock.canAccessRbac).toHaveBeenCalledWith(user);
    expect(routerNavigateSpy).not.toHaveBeenCalled();
  });

  it('redirects to dashboard when RBAC access is denied', async () => {
    const user = { id: 5, tenant_id: 77 } as any;
    authServiceMock.currentUser$ = of(user);
    authServiceMock.canAccessRbac.mockReturnValue(false);

    const result$ = TestBed.runInInjectionContext(
      () => rbacGuard({} as any, { url: '/settings/roles-permissions' } as any)
    ) as any;

    await expect(firstValueFrom(result$)).resolves.toBe(false);
    expect(authServiceMock.canAccessRbac).toHaveBeenCalledWith(user);
    expect(routerNavigateSpy).toHaveBeenCalledWith(
      ['/dashboard'],
      expect.objectContaining({
        queryParams: expect.objectContaining({ error: 'forbidden' })
      })
    );
  });
});

