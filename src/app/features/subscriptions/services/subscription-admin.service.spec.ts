import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { environment } from '@environments/environment';
import { SubscriptionAdminService, subscriptionErrorCode, subscriptionErrorMessage } from './subscription-admin.service';

describe('SubscriptionAdminService', () => {
  const base = `${environment.apiUrl}/admin/subscriptions`;
  let service: SubscriptionAdminService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(SubscriptionAdminService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists plans and unwraps the envelope, passing legacy/archived flags only when asked', () => {
    service.listPlans().subscribe((plans) => expect(plans.map((p) => p.code)).toEqual(['STARTER']));
    const plain = http.expectOne(`${base}/plans`);
    expect(plain.request.params.keys()).toEqual([]);
    plain.flush({ success: true, data: [{ id: 1, code: 'STARTER' }] });

    service.listPlans({ includeLegacy: true, includeArchived: true }).subscribe();
    const flagged = http.expectOne((r) => r.url === `${base}/plans`);
    expect(flagged.request.params.get('include_legacy')).toBe('1');
    expect(flagged.request.params.get('include_archived')).toBe('1');
    flagged.flush({ success: true, data: [] });
  });

  it('sends only the entitlement list to the version entitlements endpoint (no tenant or plan ids in body)', () => {
    service.setEntitlements(3, 9, [{ feature_code: 'PEOPLE_LIMIT', is_enabled: true, numeric_value: 250 }]).subscribe();
    const req = http.expectOne(`${base}/plans/3/versions/9/entitlements`);
    expect(req.request.method).toBe('PUT');
    expect(Object.keys(req.request.body)).toEqual(['entitlements']);
    req.flush({ success: true, data: { id: 9 } });
  });

  it('publishes with an optional schedule and reason', () => {
    service.publishVersion(3, 9, '2030-01-01T00:00:00.000Z', 'Price review').subscribe();
    const req = http.expectOne(`${base}/plans/3/versions/9/publish`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ effective_from: '2030-01-01T00:00:00.000Z', reason: 'Price review' });
    req.flush({ success: true, data: { id: 9, status: 'SCHEDULED' } });
  });

  it('migrates tenants with a dry run first', () => {
    service
      .migrateTenants(3, 9, { from_version_id: 7, dry_run: true, reason: 'Move to v2', keep_contracted_price: true })
      .subscribe((res) => expect(res.eligible).toBe(4));
    const req = http.expectOne(`${base}/plans/3/versions/9/migrate-tenants`);
    expect(req.request.body.dry_run).toBe(true);
    expect(req.request.body.tenant_id).toBeUndefined();
    req.flush({ success: true, data: { dry_run: true, eligible: 4, processed: 4, migrated: [], skipped: [], preview: [], remaining: 4 } });
  });

  it('builds plan tenant filters and trims search', () => {
    service.planTenants(3, { versionId: 7, search: '  st mary ', page: 2, perPage: 25 }).subscribe();
    const req = http.expectOne((r) => r.url === `${base}/plans/3/tenants`);
    expect(req.request.params.get('version_id')).toBe('7');
    expect(req.request.params.get('search')).toBe('st mary');
    expect(req.request.params.get('page')).toBe('2');
    req.flush({ success: true, data: [], meta: { current_page: 2, last_page: 2, per_page: 25, total: 30 } });
  });

  describe('error helpers', () => {
    it('prefers the first validation message for 422', () => {
      const err = new HttpErrorResponse({
        status: 422,
        error: { code: 'CATALOG_INVALID', message: 'Invalid', errors: { monthly_price: ['A monthly price is required.'] } },
      });
      expect(subscriptionErrorMessage(err)).toBe('A monthly price is required.');
      expect(subscriptionErrorCode(err)).toBe('CATALOG_INVALID');
    });

    it('never surfaces server error text for 5xx', () => {
      const err = new HttpErrorResponse({ status: 500, error: { message: 'SQLSTATE[42P01] relation missing' } });
      expect(subscriptionErrorMessage(err, 'Fallback')).toBe('Fallback');
    });

    it('maps 403 without a message to a plain-language permission error', () => {
      const err = new HttpErrorResponse({ status: 403, error: {} });
      expect(subscriptionErrorMessage(err)).toBe('You do not have permission to do this.');
    });

    it('reads the flattened error the app-wide interceptor re-throws', () => {
      const flattened = { status: 409, message: 'This change removes features.', code: 'PLAN_CHANGE_REQUIRES_CONFIRMATION', errors: undefined };
      expect(subscriptionErrorCode(flattened)).toBe('PLAN_CHANGE_REQUIRES_CONFIRMATION');
      expect(subscriptionErrorMessage(flattened)).toBe('This change removes features.');
      expect(subscriptionErrorMessage({ status: 422, message: 'Validation error', errors: { reason: ['Reason is required.'] } })).toBe('Reason is required.');
      expect(subscriptionErrorMessage({ status: 500, message: 'Internal server error.' }, 'Fallback')).toBe('Fallback');
      expect(subscriptionErrorCode('boom')).toBeNull();
    });
  });
});
