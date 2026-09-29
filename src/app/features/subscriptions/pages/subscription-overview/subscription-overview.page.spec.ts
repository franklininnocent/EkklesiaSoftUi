import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER, of } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { SubscriptionAdminService } from '../../services/subscription-admin.service';
import { SubscriptionOverview, SubscriptionRevenue } from '../../models/subscription-admin.models';
import { SubscriptionOverviewPage } from './subscription-overview.page';

const overview: SubscriptionOverview = {
  total_tenants: 12,
  assigned_tenants: 10,
  plans: [
    { plan_id: 3, code: 'STANDARD', name: 'Standard', is_legacy: false, status: 'ACTIVE', tenant_count: 8 },
    { plan_id: 9, code: 'LEGACY_A', name: 'Parish 2019', is_legacy: true, status: 'ACTIVE', tenant_count: 2 },
  ],
  status_counts: { ACTIVE: 9, TRIAL: 2, EXPIRING: 1, SUSPENDED: 0 },
  open_requests: 2,
  tenants_needing_attention: 3,
  usage_measured_on: '2026-09-20',
};

const revenue: SubscriptionRevenue = {
  label: 'Agreed monthly prices',
  totals: [{ currency_code: 'USD', mrr: '1200.00', arr: '14400.00' }],
  by_plan: [{ plan_id: 3, plan_name: 'Standard', currency_code: 'USD', mrr: '800.00' }],
  counted_tenants: 8,
  excluded: { trial: 2, expired: 1, suspended: 0, unpriced: 1 },
  counted_statuses: ['ACTIVE', 'LIFETIME'],
};

function setup(
  permissions: string[],
  data: { overview?: SubscriptionOverview; revenue?: SubscriptionRevenue | null; pending?: boolean } = {},
) {
  const api = {
    overview: jest.fn().mockReturnValue(data.pending ? NEVER : of(data.overview ?? overview)),
    revenue: jest.fn().mockReturnValue(of(data.revenue === undefined ? revenue : data.revenue)),
  };

  TestBed.configureTestingModule({
    imports: [SubscriptionOverviewPage],
    providers: [
      provideRouter([]),
      { provide: SubscriptionAdminService, useValue: api },
      {
        provide: AuthService,
        useValue: { isSuperAdmin: () => false, hasPermission: (p: string) => permissions.includes(p) },
      },
    ],
  });

  const fixture = TestBed.createComponent(SubscriptionOverviewPage);
  fixture.detectChanges();
  return { fixture, page: fixture.componentInstance, api };
}

const USAGE = ['subscriptions.usage.view'];
const FULL = [...USAGE, 'subscriptions.revenue.view', 'subscriptions.requests.review'];

describe('SubscriptionOverviewPage', () => {
  it('does not load without usage permission', () => {
    const { api, fixture } = setup([]);

    expect(api.overview).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('You do not have access to the subscription overview.');
  });

  it('shows loading block while overview is pending', () => {
    const { fixture } = setup(FULL, { pending: true });
    const html = fixture.nativeElement as HTMLElement;

    expect(html.querySelector('.cf-loading-block')).toBeTruthy();
    expect(html.textContent).toContain('Loading overview…');
  });

  it('shows snapshot KPIs, status, plan mix and next-step actions', () => {
    const { fixture, api } = setup(FULL);

    expect(api.overview).toHaveBeenCalled();
    expect(api.revenue).toHaveBeenCalled();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Churches');
    expect(text).toContain('On a catalog plan');
    expect(text).toContain('Plan requests waiting');
    expect(text).toContain('Churches near a limit');
    expect(text).toContain('not yet on a catalog plan');
    expect(text).toContain('Access status');
    expect(text).toContain('Agreed monthly prices');
    expect(text).toContain('Not counted');
    expect(text).toContain('Churches per plan');
    expect(text).toContain('Standard');
    expect(text).toContain('Older plan');
    expect(text).toContain('Work waiting on subscriptions');
    expect(text).not.toContain('Suspended');

    const html = fixture.nativeElement as HTMLElement;
    const review = html.querySelector('a[href="/settings/subscription/requests"]');
    const usage = html.querySelector('a[href="/settings/subscription/usage?attention=1"]');
    const plan = html.querySelector('a[href="/settings/subscription/plans/3"]');
    expect(review?.textContent?.trim()).toBe('Review requests');
    expect(usage?.textContent?.trim()).toBe('See churches');
    expect(plan?.textContent?.trim()).toBe('Standard');
    expect(html.querySelector('.cf-decision-strip')).toBeTruthy();
    expect(html.querySelector('.sa-overview__snapshot.cf-kpi-grid')).toBeTruthy();
    expect(html.querySelector('.sa-overview__status-strip')).toBeTruthy();
    expect(html.querySelector('.sa-overview__detail-split')).toBeTruthy();
    expect(html.querySelector('.sa-overview__pricing')).toBeTruthy();
    expect(html.querySelector('.sa-overview__plan-table')).toBeTruthy();
  });

  it('shows muted copy when there are no catalog plans', () => {
    const noPlans: SubscriptionOverview = { ...overview, plans: [] };
    const { fixture } = setup(FULL, { overview: noPlans });
    const html = fixture.nativeElement as HTMLElement;

    expect(fixture.nativeElement.textContent).toContain('No churches on a catalog plan yet.');
    expect(html.querySelector('.sa-overview__plan-table')).toBeNull();
  });

  it('hides the decision strip and review link when there is no waiting work', () => {
    const quiet: SubscriptionOverview = {
      ...overview,
      open_requests: 0,
      tenants_needing_attention: 0,
      total_tenants: 10,
      assigned_tenants: 10,
    };
    const { fixture, page } = setup(FULL, { overview: quiet });

    expect(page.showDecisionStrip).toBe(false);
    expect(fixture.nativeElement.querySelector('.cf-decision-strip')).toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/settings/subscription/requests"]')).toBeNull();
  });

  it('does not fetch revenue without the revenue permission', () => {
    const { api, fixture } = setup(USAGE);

    expect(api.overview).toHaveBeenCalled();
    expect(api.revenue).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).not.toContain('Agreed monthly prices');
    expect(fixture.nativeElement.textContent).not.toContain('Per month');
  });
});
