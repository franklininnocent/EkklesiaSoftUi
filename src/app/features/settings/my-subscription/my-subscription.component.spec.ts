import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TenantService } from '@core/services/tenant.service';
import { EntitlementService } from '@core/services/entitlement.service';
import { ToastService } from '@core/services/toast.service';
import { TenantSubscriptionService } from '@features/subscriptions/services/tenant-subscription.service';
import { PublicPlanCard } from '@features/subscriptions/models/subscription-admin.models';
import { TenantSubscriptionOverview, UpgradeRequest } from '@features/subscriptions/models/tenant-subscription.models';
import { MySubscriptionComponent } from './my-subscription.component';

const standard = {
  code: 'STANDARD',
  name: 'Standard',
  pricing_type: 'FIXED',
  currency_code: 'INR',
  monthly_price: '2999.00',
  annual_price: '29990.00',
  billing_intervals: ['MONTHLY', 'ANNUAL'],
  tax: { label: 'GST', rate_percent: '18.00', prices_include_tax: false },
  features: [{ code: 'CONTRIBUTION_PLANS', name: 'Contribution Plans', category: 'finance' }],
  limits: [],
  display_order: 2,
} as unknown as PublicPlanCard;

const overview: TenantSubscriptionOverview = {
  plan: { code: 'STARTER', key: 'starter', name: 'Starter', pricing_type: 'FIXED', is_legacy: false, version_number: 1 },
  lifecycle: { status: 'ACTIVE' },
  terms: {
    billing_interval: 'ANNUAL',
    currency_code: 'INR',
    contracted_price: '14990.00',
    tax_label: 'GST',
    tax: { net: '14990.00', tax: '2698.20', gross: '17688.20', rate_percent: '18.00', inclusive: false },
    version_number: 1,
    starts_at: null,
  },
  pending_change: null,
  entitlements: [
    { code: 'CONTRIBUTIONS', name: 'Contributions', category: 'finance', enabled: true, is_core: false },
    { code: 'CONTRIBUTION_PLANS', name: 'Contribution Plans', category: 'finance', enabled: false, is_core: false },
  ],
  usage: [
    { code: 'PEOPLE_LIMIT', name: 'People', unit: 'people', usage: 240, limit: 250, unlimited: false, remaining: 10, percent_used: 96, level: 'critical' },
  ],
  engine_mode: 'shadow',
};

describe('MySubscriptionComponent', () => {
  let submit: jest.Mock;
  let requests: UpgradeRequest[];

  function setup(query: Record<string, string> = {}, overviewResult = of(overview)) {
    submit = jest.fn(() =>
      of({ request: { id: 9, status: 'PENDING', requested_plan: { id: 2, code: 'STANDARD', name: 'Standard' } } as UpgradeRequest, message: 'Sent' }),
    );
    TestBed.configureTestingModule({
      imports: [MySubscriptionComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
        {
          provide: TenantService,
          useValue: { getMySubscription: () => of({ success: true, data: { status: 'ACTIVE', plan_name: 'starter', allows_gated_access: true } }) },
        },
        {
          provide: TenantSubscriptionService,
          useValue: {
            overview: () => overviewResult,
            comparison: () => of({ current_plan: { matched: true, code: 'STARTER' }, current_plan_listed: true, plans: [standard] }),
            publicPlans: () => of([standard]),
            upgradeRequests: () => of(requests),
            submitUpgradeRequest: submit,
          },
        },
        { provide: EntitlementService, useValue: { featureName: (c: string) => (c === 'CONTRIBUTION_PLANS' ? 'Contribution Plans' : c) } },
        { provide: ToastService, useValue: { success: jest.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(MySubscriptionComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => (requests = []));

  it('shows the catalog plan, price with tax, usage in words and included features', () => {
    const el = setup().nativeElement as HTMLElement;
    const text = el.textContent ?? '';
    expect(text).toContain('Starter');
    expect(text).toContain('per year');
    expect(text).toContain('plus GST');
    expect(text).toContain('240 of 250 used');
    expect(text).toContain('Almost full');
    expect(text).toContain('Contributions');
    expect(el.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('96');
  });

  it('places current subscription, plan limits and included features in one overview grid', () => {
    const el = setup().nativeElement as HTMLElement;
    const grid = el.querySelector('.my-sub-overview-grid');
    expect(grid).toBeTruthy();
    const headings = Array.from(grid!.querySelectorAll('h2')).map((node) => node.textContent?.trim());
    expect(headings).toEqual(['Current subscription', 'Plan limits', 'Included features']);
    expect(grid!.querySelectorAll(':scope > .my-sub-panel').length).toBe(3);
    expect(grid!.querySelectorAll('.my-sub-panel--snapshot').length).toBe(2);
    expect(grid!.querySelector('.my-sub-panel--features')).toBeTruthy();
  });

  it('still shows the lifecycle view when plan details cannot be loaded', () => {
    const el = setup({}, throwError(() => ({ status: 500 }))).nativeElement as HTMLElement;
    expect(el.textContent).toContain('Current subscription');
    expect(el.textContent).toContain('starter');
  });

  it('sends a request with only the plan code, interval, known feature and message', () => {
    const fixture = setup({ request: 'contribution_plans' });
    const component = fixture.componentInstance;
    expect(component.askedFeatureName).toBe('Contribution Plans');

    component.choosePlan(standard);
    expect(component.requestInterval).toBe('ANNUAL');
    component.requestMessage = '  We are growing  ';
    component.submitRequest();

    expect(submit).toHaveBeenCalledWith({
      plan_code: 'STANDARD',
      billing_interval: 'ANNUAL',
      feature_code: 'CONTRIBUTION_PLANS',
      message: 'We are growing',
    });
    expect(component.selectedPlan).toBeNull();
    expect(component.openRequest?.status).toBe('PENDING');
    expect(component.canRequest).toBe(false);
  });

  it('ignores an unsafe feature code in the address bar', () => {
    const component = setup({ request: '<script>' }).componentInstance;
    expect(component.askedFeature).toBeNull();
  });

  it('lets the church answer when Ekklesia asks for more information', () => {
    requests = [{ id: 3, status: 'INFO_REQUESTED', review_notes: 'How many families?' } as UpgradeRequest];
    const fixture = setup();
    expect(fixture.componentInstance.canRequest).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('How many families?');
  });

  it('uses the comparison snapshot so a lifetime enterprise plan is current, not a quote', () => {
    const enterprise = {
      ...standard,
      code: 'ENTERPRISE',
      name: 'Enterprise',
      pricing_type: 'CUSTOM',
      is_current: true,
      primary_action: 'current',
      is_lifetime: true,
      subscription_status: 'LIFETIME',
      monthly_price: null,
      annual_price: null,
    } as PublicPlanCard;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [MySubscriptionComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
        {
          provide: TenantService,
          useValue: {
            getMySubscription: () =>
              of({ success: true, data: { status: 'LIFETIME', plan_name: 'Enterprise', allows_gated_access: true, subscription_ends_at: null } }),
          },
        },
        {
          provide: TenantSubscriptionService,
          useValue: {
            overview: () => of({ ...overview, plan: { ...overview.plan!, code: 'ENTERPRISE', name: 'Enterprise', pricing_type: 'CUSTOM' } }),
            comparison: () =>
              of({
                current_plan: { matched: true, code: 'ENTERPRISE', name: 'Enterprise', is_lifetime: true, subscription_status: 'LIFETIME' },
                current_plan_listed: true,
                plans: [enterprise],
              }),
            upgradeRequests: () => of([]),
          },
        },
        { provide: EntitlementService, useValue: { featureName: (c: string) => c } },
        { provide: ToastService, useValue: { success: jest.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(MySubscriptionComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Enterprise');
    expect(el.textContent).toContain('Lifetime');
    expect(el.textContent).toContain('No end date');
    expect(el.textContent).toContain('Your Current Plan');
    expect(el.textContent).not.toContain('Ask for a quote');
    expect(fixture.componentInstance.currentPlanCode).toBe('ENTERPRISE');
  });
});
