import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { Observable, firstValueFrom, of } from 'rxjs';
import { EntitlementService } from '@core/services/entitlement.service';
import { entitlementGuard, routeFeatureCodes } from './entitlement.guard';

describe('entitlementGuard', () => {
  let applies: boolean;
  let features: Record<string, boolean>;
  const entitlements = {
    appliesToCurrentUser: () => applies,
    load: jest.fn(() => of(null)),
    hasFeature: (code: string) => features[code] !== false,
  };

  function route(feature?: string | string[]): ActivatedRouteSnapshot {
    return { data: feature === undefined ? {} : { feature } } as unknown as ActivatedRouteSnapshot;
  }

  function run(feature?: string | string[]): Promise<boolean | UrlTree> {
    return TestBed.runInInjectionContext(() =>
      firstValueFrom(entitlementGuard(route(feature), {} as RouterStateSnapshot) as Observable<boolean | UrlTree>),
    );
  }

  beforeEach(() => {
    applies = true;
    features = { CONTRIBUTIONS: true, CONTRIBUTION_PLANS: false };
    entitlements.load.mockClear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: EntitlementService, useValue: entitlements }],
    });
  });

  it('normalises route feature codes', () => {
    expect(routeFeatureCodes(route(' contribution_plans '))).toEqual(['CONTRIBUTION_PLANS']);
    expect(routeFeatureCodes(route(['a', '']))).toEqual(['A']);
    expect(routeFeatureCodes(route())).toEqual([]);
  });

  it('allows routes without a feature and platform staff without loading', async () => {
    expect(await run()).toBe(true);
    applies = false;
    expect(await run('CONTRIBUTION_PLANS')).toBe(true);
    expect(entitlements.load).not.toHaveBeenCalled();
  });

  it('allows an included feature', async () => {
    expect(await run('CONTRIBUTIONS')).toBe(true);
  });

  it('sends a missing feature to the plain explanation page', async () => {
    const result = await run(['CONTRIBUTIONS', 'CONTRIBUTION_PLANS']);
    const router = TestBed.inject(Router);
    expect(result instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(result as UrlTree)).toBe('/feature-unavailable?feature=CONTRIBUTION_PLANS');
  });
});
