import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { BehaviorSubject } from 'rxjs';
import { environment } from '@environments/environment';
import { AuthService } from './auth.service';
import { SubscriptionAccessService } from './subscription-access.service';
import { EntitlementMap, EntitlementService } from './entitlement.service';

function map(overrides: Partial<EntitlementMap> = {}): EntitlementMap {
  return {
    source: 'plan',
    engine_mode: 'enforce',
    plan: { code: 'STARTER', key: 'starter', name: 'Starter', pricing_type: 'FIXED', is_legacy: false, version_number: 1 },
    features: { CONTRIBUTIONS: true, CONTRIBUTION_PLANS: false },
    feature_names: { CONTRIBUTION_PLANS: 'Contribution Plans' },
    limits: { PEOPLE_LIMIT: 250, STORAGE_LIMIT: null },
    limits_enforced: true,
    hash: 'h1',
    ...overrides,
  };
}

describe('EntitlementService', () => {
  const url = `${environment.apiUrl}/tenant/entitlements`;
  let service: EntitlementService;
  let http: HttpTestingController;
  let user: { tenant_id: number | null } | null;
  let snapshot$: BehaviorSubject<{ entitlements_version?: string } | null>;

  beforeEach(() => {
    user = { tenant_id: 5 };
    snapshot$ = new BehaviorSubject<{ entitlements_version?: string } | null>(null);
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: AuthService, useValue: { get currentUserValue() { return user; } } },
        { provide: SubscriptionAccessService, useValue: { snapshot$ } },
      ],
    });
    service = TestBed.inject(EntitlementService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads features as available before the map loads (UI only, never a grant)', () => {
    expect(service.hasFeature('CONTRIBUTION_PLANS')).toBe(true);
  });

  it('loads the map once per church and answers feature and limit questions', () => {
    service.load().subscribe();
    http.expectOne(url).flush({ success: true, data: map() });
    service.load().subscribe();
    http.expectNone(url);

    expect(service.hasFeature('contributions')).toBe(true);
    expect(service.hasFeature('CONTRIBUTION_PLANS')).toBe(false);
    expect(service.hasAllFeatures(['CONTRIBUTIONS', 'CONTRIBUTION_PLANS'])).toBe(false);
    expect(service.featureName('contribution_plans')).toBe('Contribution Plans');
    expect(service.featureName('AUDIT_LOG')).toBe('Audit log');
    expect(service.getLimit('PEOPLE_LIMIT')).toBe(250);
    expect(service.getLimit('STORAGE_LIMIT')).toBeNull();
    expect(service.getLimit('UNKNOWN')).toBeUndefined();
    expect(service.isWithinLimit('PEOPLE_LIMIT', 249)).toBe(true);
    expect(service.isWithinLimit('PEOPLE_LIMIT', 250)).toBe(false);
    expect(service.plan()?.code).toBe('STARTER');
  });

  it('does not treat limits as blocking when the server is not enforcing them', () => {
    service.load().subscribe();
    http.expectOne(url).flush({ success: true, data: map({ limits_enforced: false }) });
    expect(service.isWithinLimit('PEOPLE_LIMIT', 900)).toBe(true);
  });

  it('never applies plan gating to platform staff without a church', () => {
    user = { tenant_id: null };
    let result: unknown = 'unset';
    service.load().subscribe((r) => (result = r));
    http.expectNone(url);
    expect(result).toBeNull();
    expect(service.hasFeature('ANYTHING')).toBe(true);
  });

  it('keeps the last known map when a refresh fails', () => {
    service.load().subscribe();
    http.expectOne(url).flush({ success: true, data: map() });
    service.refresh().subscribe();
    http.expectOne(url).flush('boom', { status: 500, statusText: 'Server Error' });
    expect(service.hasFeature('CONTRIBUTION_PLANS')).toBe(false);
  });

  it('refreshes when the access poll reports a new entitlements version', () => {
    service.load().subscribe();
    http.expectOne(url).flush({ success: true, data: map() });

    snapshot$.next({ entitlements_version: 'h1' });
    http.expectNone(url);

    snapshot$.next({ entitlements_version: 'h2' });
    http.expectOne(url).flush({ success: true, data: map({ hash: 'h2', features: { CONTRIBUTION_PLANS: true } }) });
    expect(service.hasFeature('CONTRIBUTION_PLANS')).toBe(true);
  });

  it('clear() forgets the church map', () => {
    service.load().subscribe();
    http.expectOne(url).flush({ success: true, data: map() });
    service.clear();
    expect(service.entitlements()).toBeNull();
    expect(service.hasFeature('CONTRIBUTION_PLANS')).toBe(true);
  });
});
