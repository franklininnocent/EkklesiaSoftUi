import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, ParamMap } from '@angular/router';
import { of, throwError, firstValueFrom } from 'rxjs';
import { tenantGuard } from './tenant.guard';
import { TenantService } from '@core/services/tenant.service';

function createParamMap(values: Record<string, string>): ParamMap {
  return {
    has: (name: string) => values[name] !== undefined,
    get: (name: string) => values[name] ?? null,
    getAll: (name: string) => (values[name] ? [values[name]] : []),
    keys: Object.keys(values)
  } as ParamMap;
}

describe('tenantGuard', () => {
  let routerNavigateSpy: jest.SpyInstance;
  let tenantService: any;

  beforeEach(() => {
    const routerSpy = {
      navigate: jest.fn()
    } as unknown as Router;

    tenantService = { getTenant: jest.fn() } as unknown as TenantService;

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: routerSpy },
        { provide: TenantService, useValue: tenantService }
      ]
    });

    const router = TestBed.inject(Router);
    routerNavigateSpy = jest.spyOn(router, 'navigate');
  });

  function makeRoute(tenantId?: string): ActivatedRouteSnapshot {
    return {
      paramMap: createParamMap(tenantId ? { tenantId } : {})
    } as unknown as ActivatedRouteSnapshot;
  }

  it('returns true when tenant exists and is active', async () => {
    (tenantService.getTenant as any).mockReturnValue(of({ success: true, data: { id: 5, active: 1 } } as any));
    const result$ = TestBed.runInInjectionContext(() => tenantGuard(makeRoute('5'), {} as any)) as any;
    await expect(firstValueFrom(result$)).resolves.toBe(true);
    expect(routerNavigateSpy).not.toHaveBeenCalled();
  });

  it('navigates to login with inactive error when tenant is inactive', async () => {
    (tenantService.getTenant as any).mockReturnValue(of({ success: true, data: { id: 7, active: 0 } } as any));
    const result$ = TestBed.runInInjectionContext(() => tenantGuard(makeRoute('7'), {} as any)) as any;
    await expect(firstValueFrom(result$)).resolves.toBe(false);
    expect(routerNavigateSpy).toHaveBeenCalledWith(['/auth/login'], { queryParams: { error: 'Tenant is not active' } });
  });

  it('navigates to login with invalid tenant when response not successful', async () => {
    (tenantService.getTenant as any).mockReturnValue(of({ success: false } as any));
    const result$ = TestBed.runInInjectionContext(() => tenantGuard(makeRoute('9'), {} as any)) as any;
    await expect(firstValueFrom(result$)).resolves.toBe(false);
    expect(routerNavigateSpy).toHaveBeenCalledWith(['/auth/login'], { queryParams: { error: 'Invalid tenant' } });
  });

  it('navigates to login with invalid tenant on error', async () => {
    (tenantService.getTenant as any).mockReturnValue(throwError(() => new Error('network')));
    const result$ = TestBed.runInInjectionContext(() => tenantGuard(makeRoute('12'), {} as any)) as any;
    await expect(firstValueFrom(result$)).resolves.toBe(false);
    expect(routerNavigateSpy).toHaveBeenCalledWith(['/auth/login'], { queryParams: { error: 'Invalid tenant' } });
  });

  it('navigates to login immediately when tenantId is missing', () => {
    const result = TestBed.runInInjectionContext(() => tenantGuard(makeRoute() as any, {} as any)) as any;
    expect(result).toBe(false);
    expect(routerNavigateSpy).toHaveBeenCalledWith(['/auth/login']);
  });
});


