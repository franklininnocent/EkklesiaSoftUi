import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { of, firstValueFrom } from 'rxjs';
import { tenantAdminGuard } from './tenant-admin.guard';

describe('tenantAdminGuard', () => {
  let routerNavigateSpy: jest.SpyInstance;
  let storeSelectSpy: jest.SpyInstance;

  beforeEach(() => {
    const routerSpy = {
      navigate: jest.fn()
    } as unknown as Router;

    const storeSpy = {
      select: jest.fn()
    } as unknown as Store;

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: routerSpy },
        { provide: Store, useValue: storeSpy }
      ]
    });

    const router = TestBed.inject(Router);
    routerNavigateSpy = jest.spyOn(router, 'navigate');

    const store = TestBed.inject(Store);
    storeSelectSpy = jest.spyOn(store, 'select');
  });

  it('allows SuperAdmin via role_name', async () => {
    storeSelectSpy.mockReturnValue(of({ id: 1, role_name: 'SuperAdmin' } as any));
    const result$ = TestBed.runInInjectionContext(() => tenantAdminGuard()) as any;
    await expect(firstValueFrom(result$)).resolves.toBe(true);
    expect(routerNavigateSpy).not.toHaveBeenCalled();
  });

  it('allows EkklesiaAdmin via nested role.name', async () => {
    storeSelectSpy.mockReturnValue(of({ id: 2, role: { name: 'EkklesiaAdmin' } } as any));
    const result$ = TestBed.runInInjectionContext(() => tenantAdminGuard()) as any;
    await expect(firstValueFrom(result$)).resolves.toBe(true);
    expect(routerNavigateSpy).not.toHaveBeenCalled();
  });

  it('denies tenant user and redirects to /dashboard', async () => {
    storeSelectSpy.mockReturnValue(of({ id: 3, role_name: 'TenantUser' } as any));
    const result$ = TestBed.runInInjectionContext(() => tenantAdminGuard()) as any;
    await expect(firstValueFrom(result$)).resolves.toBe(false);
    expect(routerNavigateSpy).toHaveBeenCalledWith(['/dashboard']);
  });

  it('redirects to login when user missing (edge case)', async () => {
    storeSelectSpy.mockReturnValue(of(null));
    const result$ = TestBed.runInInjectionContext(() => tenantAdminGuard()) as any;
    await expect(firstValueFrom(result$)).resolves.toBe(false);
    expect(routerNavigateSpy).toHaveBeenCalledWith(['/auth/login']);
  });
});


