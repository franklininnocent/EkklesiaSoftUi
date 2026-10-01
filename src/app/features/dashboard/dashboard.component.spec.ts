import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { Store } from '@ngrx/store';
import { of, throwError } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { BCCService } from '@core/services/bcc.service';
import { FamilyService } from '@core/services/family.service';
import { MemberService } from '@features/members/services/member.service';
import { SacramentService } from '@features/settings/sacraments/services/sacrament.service';
import { DonationsService } from '@features/donations/services/donations.service';
import { PastoralCareService } from '@features/pastoral-care/services/pastoral-care.service';
import { MinistriesApiService } from '@features/ministries-associations/services/ministries-api.service';
import { SupportSessionService } from '@features/support-center/services/support-session.service';
import { SubscriptionAccessService } from '@core/services/subscription-access.service';
import { EntitlementService } from '@core/services/entitlement.service';
import { TenantService } from '@core/services/tenant.service';
import { Router } from '@angular/router';
import { DashboardComponent } from './dashboard.component';
import { ExecutiveDashboardService } from './services/executive-dashboard.service';
import { QuickCollectService } from '@features/donations/services/quick-collect.service';

function buildExecutiveDashboardFixture(overrides: Record<string, unknown> = {}) {
  return {
    snapshot: {
      state: 'ready',
      data: {
        cards: {
          families: { active_families: 8, total_families: 10, drilldown: 'families.directory' },
          members: {
            active_members: 22,
            total_members: 25,
            members_added_this_month: 3,
            drilldown: 'members.directory',
          },
          life_groups: { active_bccs: 5, household_coverage_percent: 40, drilldown: 'bcc.home' },
        },
      },
    },
    attention: { state: 'ready', data: { items: [], all_clear: true } },
    stewardship: {
      state: 'ready',
      data: {
        currency_code: 'INR',
        as_of: '2026-09-15',
        financial_year: '2026',
        giving_health_label: 'Healthy',
        collected: 1500,
        comparison_start: '2026-08-01',
        comparison_end: '2026-08-15',
        comparison_collected: 800,
        growth_pct: 88,
        outstanding_contributions: 200,
        project_installments_open: 0,
        overdue_amount: 75,
        overdue_families: 1,
        due_next_14_days_amount: 50,
        due_later_amount: 75,
        due_schedule: [
          { key: 'overdue', label: 'Overdue', amount: 75, percent: 37.5 },
          { key: 'next_14_days', label: 'Next 14 days', amount: 50, percent: 25 },
          { key: 'later', label: 'Later', amount: 75, percent: 37.5 },
        ],
        participation_rate: 42.5,
        participation_participating: 17,
        participation_active: 40,
        participation_net_change: 2,
        participation_window_start: '2026-06-17',
        participation_window_end: '2026-09-15',
      },
    },
    worship: { state: 'forbidden' },
    celebrations: { state: 'forbidden' },
    quick_actions: { state: 'empty', data: { actions: [] } },
    ...overrides,
  };
}

const familyStatsFixture = {
  success: true,
  data: {
    total_families: 10,
    active_families: 8,
    inactive_families: 2,
    total_members: 25,
    active_members: 22,
    members_created_this_month: 3,
    families_with_bcc: 4,
    families_without_bcc: 6,
    families_by_zone: [],
  },
};

const celebrationsFixture = {
  success: true,
  data: {
    week: { start: '2026-06-15', end: '2026-06-21', label: 'Jun 15 – Jun 21', timezone: 'Asia/Kolkata' },
    birthdays: [],
    anniversaries: [],
  },
};

const memberServiceMock = {
  getCelebrations: jest.fn(() => of(celebrationsFixture)),
};

const bccStatsFixture = {
  success: true,
  data: {
    total_bccs: 5,
    active_bccs: 0,
    inactive_bccs: 5,
    bccs_with_space: 0,
    total_families_in_bcc: 4,
    total_families_in_bccs: 4,
    total_leaders: 2,
    total_capacity: 0,
    current_utilization: 4,
    utilization_percentage: 0,
    bccs_by_zone: [],
  },
};

describe('DashboardComponent (ministries module-status)', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let ministriesApi: { getModuleStatus: jest.Mock };
  let auth: {
    canAccessMinistries: jest.Mock;
    canAccessDonations: jest.Mock;
    canAccessPastoral: jest.Mock;
    hasPermission: jest.Mock;
    isSuperAdmin: jest.Mock;
    isPlatformActor: jest.Mock;
    canManageTenants: jest.Mock;
  };
  let supportSessionId: string | null;

  beforeEach(async () => {
    supportSessionId = null;
    ministriesApi = {
      getModuleStatus: jest.fn(() => of({ success: true, data: { enabled: false, feature_key: 'ministries_associations' } })),
    };
    auth = {
      canAccessMinistries: jest.fn(() => false),
      canAccessDonations: jest.fn(() => false),
      canAccessPastoral: jest.fn(() => false),
      hasPermission: jest.fn(() => false),
      isSuperAdmin: jest.fn(() => false),
    isPlatformActor: jest.fn(() => true),
    canManageTenants: jest.fn(() => false),
  };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        {
          provide: Store,
          useValue: {
            select: jest.fn(() =>
              of({
                id: 1,
                name: 'Platform Admin',
                tenant_id: null,
                role_name: 'EkklesiaAdmin',
              })
            ),
          },
        },
        { provide: AuthService, useValue: auth },
        {
          provide: SupportSessionService,
          useValue: {
            session$: of(null),
            get sessionId() {
              return supportSessionId;
            },
          },
        },
        { provide: MinistriesApiService, useValue: ministriesApi },
        {
          provide: TenantService,
          useValue: { getStatistics: jest.fn(() => of({ success: true, data: null })) },
        },
        {
          provide: FamilyService,
          useValue: { getStatistics: jest.fn(() => of(familyStatsFixture)) },
        },
        {
          provide: BCCService,
          useValue: { getStatistics: jest.fn(() => of(bccStatsFixture)) },
        },
        {
          provide: SubscriptionAccessService,
          useValue: { isReadOnly: jest.fn(() => false) },
        },
        {
          provide: EntitlementService,
          useValue: {
            load: () => of(null),
            refresh: () => of(null),
            hasFeature: () => true,
            hasAllFeatures: () => true,
            appliesToCurrentUser: () => false,
          },
        },
        { provide: MemberService, useValue: memberServiceMock },
        {
          provide: SacramentService,
          useValue: { getDashboardSummary: jest.fn(() => of({ success: true, data: {} })) },
        },
        {
          provide: DonationsService,
          useValue: { getOperationsDashboard: jest.fn(() => of({ success: true, data: {} })) },
        },
        {
          provide: PastoralCareService,
          useValue: {
            dashboard: jest.fn(() => of({ alerts: [], tasks: [] })),
            staff: jest.fn(() => of([])),
          },
        },
        {
          provide: ExecutiveDashboardService,
          useValue: { getExecutive: jest.fn(() => of(buildExecutiveDashboardFixture())) },
        },
        { provide: QuickCollectService, useValue: { open: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
  });

  it('does not call tenant module-status for EkklesiaAdmin without parish context', () => {
    auth.canAccessMinistries.mockReturnValue(false);

    fixture.detectChanges();

    expect(ministriesApi.getModuleStatus).not.toHaveBeenCalled();
  });

  it('does not load the ministries workspace during a support session', () => {
    supportSessionId = 'session-live';
    auth.canAccessMinistries.mockReturnValue(true);

    fixture.detectChanges();

    expect(ministriesApi.getModuleStatus).not.toHaveBeenCalled();
  });
});

describe('DashboardComponent (Stewardship Hub)', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let donationsService: { getOperationsDashboard: jest.Mock };
  let executiveDashboard: { getExecutive: jest.Mock };
  let auth: {
    canAccessDonations: jest.Mock;
    canAccessMinistries: jest.Mock;
    canAccessPastoral: jest.Mock;
    hasPermission: jest.Mock;
    isSuperAdmin: jest.Mock;
    isPlatformActor: jest.Mock;
    canManageTenants: jest.Mock;
  };

  const tenantUser = {
    id: 2,
    name: 'Parish Admin',
    tenant_id: 10,
    role_name: 'Administrator',
  };

  const liveOpsPayload = {
    success: true,
    data: {
      tenant_context: { currency_code: 'INR' },
      period: { month_start: '2026-09-01', month_end: '2026-09-30', timezone: 'Asia/Kolkata' },
      collection_trend: [
        { period: '2026-04', label: 'Apr 2026', collected: 0 },
        { period: '2026-05', label: 'May 2026', collected: 1000 },
        { period: '2026-06', label: 'Jun 2026', collected: 1200 },
        { period: '2026-07', label: 'Jul 2026', collected: 0 },
        { period: '2026-08', label: 'Aug 2026', collected: 800 },
        { period: '2026-09', label: 'Sep 2026', collected: 1500 },
      ],
      collections_by_method_this_month: { cash: 1500 },
      financial: {
        totals: { current_month_collected: 1500, pending_dues: 200, collected: 5000, annual_collected: 4000 },
        families: { participation_rate: 42.5, active: 10 },
        attention_summary: { count: 1, total_overdue_amount: 75 },
        health: { score: 82, label: 'Healthy', status: 'healthy' },
      },
    },
  };

  beforeEach(async () => {
    executiveDashboard = {
      getExecutive: jest.fn(() => of(buildExecutiveDashboardFixture())),
    };
    donationsService = {
      getOperationsDashboard: jest.fn(() => of(liveOpsPayload)),
    };
    auth = {
      canAccessMinistries: jest.fn(() => false),
      canAccessDonations: jest.fn(() => true),
      canAccessPastoral: jest.fn(() => false),
      hasPermission: jest.fn(() => false),
      isSuperAdmin: jest.fn(() => false),
      isPlatformActor: jest.fn(() => false),
      canManageTenants: jest.fn(() => false),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        {
          provide: Store,
          useValue: {
            select: jest.fn(() => of(tenantUser)),
          },
        },
        { provide: AuthService, useValue: auth },
        {
          provide: SupportSessionService,
          useValue: {
            session$: of(null),
            get sessionId() {
              return null;
            },
          },
        },
        { provide: DonationsService, useValue: donationsService },
        {
          provide: TenantService,
          useValue: { getStatistics: jest.fn(() => of({ success: true, data: null })) },
        },
        {
          provide: FamilyService,
          useValue: { getStatistics: jest.fn(() => of(familyStatsFixture)) },
        },
        {
          provide: BCCService,
          useValue: { getStatistics: jest.fn(() => of(bccStatsFixture)) },
        },
        {
          provide: SubscriptionAccessService,
          useValue: { isReadOnly: jest.fn(() => false) },
        },
        {
          provide: EntitlementService,
          useValue: {
            load: () => of(null),
            refresh: () => of(null),
            hasFeature: () => true,
            hasAllFeatures: () => true,
            appliesToCurrentUser: () => false,
          },
        },
        { provide: MemberService, useValue: memberServiceMock },
        {
          provide: SacramentService,
          useValue: { getDashboardSummary: jest.fn(() => of({ success: true, data: {} })) },
        },
        {
          provide: PastoralCareService,
          useValue: {
            dashboard: jest.fn(() => of({ alerts: [], tasks: [] })),
            staff: jest.fn(() => of([])),
          },
        },
        {
          provide: MinistriesApiService,
          useValue: { getModuleStatus: jest.fn(() => of({ success: true, data: { enabled: false } })) },
        },
        { provide: ExecutiveDashboardService, useValue: executiveDashboard },
        { provide: QuickCollectService, useValue: { open: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
  });

  it('does not show demo USD placeholders when live data loads', () => {
    fixture.detectChanges();

    const html = fixture.nativeElement.textContent;
    expect(html).not.toContain('$168,400');
    expect(html).not.toContain('Mobile App');
    expect(html).not.toContain('$42,850');
    expect(html).not.toContain('New Visitors');
    expect(html).not.toContain('Live operations');
    expect(html).not.toContain('Kids Ministry Briefing');
    expect(html).toContain('₹1,500');
    expect(html).toContain('People executive summary');
    expect(donationsService.getOperationsDashboard).not.toHaveBeenCalled();
  });

  it('shows the donations snapshot metrics and comparable-day growth', () => {
    fixture.detectChanges();

    const html = fixture.nativeElement.textContent as string;
    expect(html).toContain('Financial executive summary');
    expect(html).toContain('Collected this month');
    expect(html).toContain('Same days last month');
    expect(html).toContain('Outstanding contributions');
    expect(html).toContain('Up 88% versus 1 Aug 2026 – 15 Aug 2026');
    expect(html).toContain('Giving health: Healthy');
    expect(html).toContain('Due schedule');
    expect(html).toContain('Next 14 days');
    expect(html).not.toContain('Collections trend');
    expect(html).not.toContain('Last 6 months');
    expect(fixture.nativeElement.querySelector('.cd-chart')).toBeNull();

    const tone = (label: string) =>
      Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
        .find((el) => el.textContent?.includes(label));
    expect(tone('Collected this month')?.classList).toContain('cd-financial-metric--stew-teal');
    expect(tone('Same days last month')?.classList).toContain('cd-financial-metric--stew-violet');
    expect(tone('Overdue')?.classList).toContain('cd-financial-metric--critical');
    expect(tone('Outstanding contributions')?.classList).toContain('cd-financial-metric--stew-gold');
    const peopleMetric = fixture.nativeElement.querySelector('[data-exec-block="people"] .cd-financial-metric') as HTMLElement;
    expect(peopleMetric.classList).toContain('cd-financial-metric--indigo');
  });

  it('opens the matching donations page for each snapshot metric', () => {
    const router = TestBed.inject(Router);
    const navigate = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();

    const clickLabel = (label: string) => {
      const button = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
        .find((el) => el.textContent?.includes(label));
      expect(button).toBeTruthy();
      button?.click();
    };

    clickLabel('Collected this month');
    expect(navigate).toHaveBeenCalledWith(['/donations/payments'], {
      queryParams: { paid_from: '2026-09-01', paid_to: '2026-09-15' },
    });

    clickLabel('Same days last month');
    expect(navigate).toHaveBeenCalledWith(['/donations/payments'], {
      queryParams: { paid_from: '2026-08-01', paid_to: '2026-08-15' },
    });

    clickLabel('Outstanding contributions');
    expect(navigate).toHaveBeenCalledWith(['/donations/dues']);

    clickLabel('Overdue');
    expect(navigate).toHaveBeenCalledWith(['/donations/dues'], {
      queryParams: { overdue_only: '1' },
    });
  });

  it('shows a compact overdue follow-up on Operations and omits module workspaces', () => {
    const router = TestBed.inject(Router);
    const navigate = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    fixture.componentInstance.selectTab('operations');
    fixture.detectChanges();

    const html = fixture.nativeElement.textContent as string;
    expect(html).toContain('Follow-up work');
    expect(html).toContain('Parish summary');
    expect(html).toContain('Families needing follow-up');
    expect(html).toContain('1');
    expect(html).toContain('family overdue');
    expect(html).toContain('₹75');
    expect(html).toContain('Review overdue families');
    expect(html).not.toContain('BCC Overview');
    expect(html).not.toContain('Sacramental Records');
    expect(html).not.toContain('Ministries Actions');
    expect(html).not.toContain('Parish record queues');

    const button = fixture.nativeElement.querySelector('[data-ops-followup="overdue-families"] .cd-ops-followup') as HTMLButtonElement;
    expect(button).toBeTruthy();
    button.click();
    expect(navigate).toHaveBeenCalledWith(['/donations/dues'], {
      queryParams: { overdue_only: '1' },
    });
    expect(donationsService.getOperationsDashboard).toHaveBeenCalled();
  });

  it('does not show a zero overdue count when the attention summary is missing', () => {
    donationsService.getOperationsDashboard.mockReturnValue(of({
      success: true,
      data: {
        tenant_context: { currency_code: 'INR' },
        financial: {
          totals: { collected: 1, pending_dues: 0, current_month_collected: 1, annual_collected: 1 },
        },
      },
    }));
    fixture.detectChanges();
    fixture.componentInstance.selectTab('operations');
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector('[data-ops-followup="overdue-families"]') as HTMLElement;
    expect(panel.textContent).toContain('Could not load stewardship follow-ups right now.');
    expect(panel.querySelector('.cd-ops-followup')).toBeNull();
    expect(panel.textContent).not.toContain('family overdue');
  });

  it('hides stewardship on overview when donations access is denied', () => {
    auth.canAccessDonations.mockReturnValue(false);
    executiveDashboard.getExecutive.mockReturnValue(
      of(
        buildExecutiveDashboardFixture({
          snapshot: {
            state: 'ready',
            data: {
              cards: {
                families: { active_families: 8, total_families: 10, drilldown: 'families.directory' },
              },
            },
          },
          stewardship: { state: 'forbidden' },
        })
      )
    );

    fixture.detectChanges();

    const html = fixture.nativeElement.textContent;
    expect(html).not.toContain('Financial executive summary');
    expect(html).not.toContain('Collected this month');
    expect(html).not.toContain('₹1,500');
    expect(html).not.toContain('$168,400');
    expect(donationsService.getOperationsDashboard).not.toHaveBeenCalled();
  });

  it('shows error state without demo money when stewardship section fails', () => {
    executiveDashboard.getExecutive.mockReturnValue(
      of(buildExecutiveDashboardFixture({ stewardship: { state: 'error' } }))
    );

    fixture.detectChanges();

    const html = fixture.nativeElement.textContent;
    expect(html).toContain('Financial executive summary');
    expect(html).toContain('Unable to load this section');
    expect(html).not.toContain('₹1,500');
    expect(html).not.toContain('₹0');
    expect(html).not.toContain('$168,400');
    expect(fixture.nativeElement.querySelector('[data-exec-block="finance"] .cd-financial-metric')).toBeNull();
  });

  it('shows an unavailable message without zero amounts when currency is missing', () => {
    executiveDashboard.getExecutive.mockReturnValue(
      of(buildExecutiveDashboardFixture({ stewardship: { state: 'unavailable' } }))
    );

    fixture.detectChanges();

    const html = fixture.nativeElement.textContent as string;
    expect(html).toContain('Giving figures are unavailable until the church currency is set.');
    expect(html).not.toContain('₹');
    expect(fixture.nativeElement.querySelector('[data-exec-block="finance"] .cd-financial-metric')).toBeNull();
  });

  it('shows a real zero when the donations snapshot collected nothing', () => {
    executiveDashboard.getExecutive.mockReturnValue(
      of(
        buildExecutiveDashboardFixture({
          stewardship: {
            state: 'ready',
            data: {
              currency_code: 'INR',
              as_of: '2026-09-15',
              financial_year: '2026',
              giving_health_label: 'Needs Attention',
              collected: 0,
              comparison_start: '2026-08-01',
              comparison_end: '2026-08-15',
              comparison_collected: 0,
              growth_pct: null,
              outstanding_contributions: 0,
              project_installments_open: null,
              overdue_amount: 0,
              overdue_families: 0,
              participation_rate: 0,
              participation_participating: 0,
              participation_active: 8,
              participation_net_change: 0,
              participation_window_start: '2026-06-17',
              participation_window_end: '2026-09-15',
            },
          },
        })
      )
    );

    fixture.detectChanges();

    const html = fixture.nativeElement.textContent as string;
    expect(html).toContain('₹0.00');
    expect(html).toContain('No comparable period last month');
    expect(html).not.toContain('Family participation');
    expect(html).not.toContain('Project installments');
  });
});

describe('DashboardComponent (Overview metrics)', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let executiveDashboard: { getExecutive: jest.Mock };
  let auth: {
    canAccessDonations: jest.Mock;
    canAccessMinistries: jest.Mock;
    canAccessPastoral: jest.Mock;
    hasPermission: jest.Mock;
    isSuperAdmin: jest.Mock;
    isPlatformActor: jest.Mock;
    canManageTenants: jest.Mock;
  };

  const tenantUser = {
    id: 3,
    name: 'Parish Staff',
    tenant_id: 11,
    role_name: 'Administrator',
  };

  beforeEach(async () => {
    executiveDashboard = {
      getExecutive: jest.fn(() => of(buildExecutiveDashboardFixture())),
    };
    auth = {
      canAccessMinistries: jest.fn(() => false),
      canAccessDonations: jest.fn(() => false),
      canAccessPastoral: jest.fn(() => false),
      hasPermission: jest.fn(() => false),
      isSuperAdmin: jest.fn(() => false),
      isPlatformActor: jest.fn(() => false),
      canManageTenants: jest.fn(() => false),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        {
          provide: Store,
          useValue: {
            select: jest.fn(() => of(tenantUser)),
          },
        },
        { provide: AuthService, useValue: auth },
        {
          provide: SupportSessionService,
          useValue: {
            session$: of(null),
            get sessionId() {
              return null;
            },
          },
        },
        {
          provide: TenantService,
          useValue: { getStatistics: jest.fn(() => of({ success: true, data: null })) },
        },
        {
          provide: FamilyService,
          useValue: { getStatistics: jest.fn(() => of(familyStatsFixture)) },
        },
        {
          provide: BCCService,
          useValue: { getStatistics: jest.fn(() => of(bccStatsFixture)) },
        },
        {
          provide: DonationsService,
          useValue: { getOperationsDashboard: jest.fn(() => of({ success: true, data: {} })) },
        },
        { provide: MemberService, useValue: memberServiceMock },
        {
          provide: SacramentService,
          useValue: { getDashboardSummary: jest.fn(() => of({ success: true, data: {} })) },
        },
        {
          provide: PastoralCareService,
          useValue: {
            dashboard: jest.fn(() => of({ alerts: [], tasks: [] })),
            staff: jest.fn(() => of([])),
          },
        },
        {
          provide: MinistriesApiService,
          useValue: { getModuleStatus: jest.fn(() => of({ success: true, data: { enabled: false } })) },
        },
        {
          provide: SubscriptionAccessService,
          useValue: { isReadOnly: jest.fn(() => false) },
        },
        {
          provide: EntitlementService,
          useValue: {
            load: () => of(null),
            refresh: () => of(null),
            hasFeature: () => true,
            hasAllFeatures: () => true,
            appliesToCurrentUser: () => false,
          },
        },
        { provide: ExecutiveDashboardService, useValue: executiveDashboard },
        { provide: QuickCollectService, useValue: { open: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
  });

  it('renders executive snapshot metrics without demo placeholders', () => {
    fixture.detectChanges();

    const html = fixture.nativeElement.textContent;
    expect(html).not.toContain('47');
    expect(html).not.toContain('78%');
    expect(html).not.toContain('Assimilation Progress');
    expect(html).not.toContain('Visitors to Active');
    expect(html).toContain('records added this month');
    expect(html).toContain('total ·');
    expect(html).toContain('BCC');
    expect(html).toContain('Open BCC');
    expect(html).not.toContain('Life Groups');
    expect(html).toContain('40% of all families assigned to a BCC');
    expect(html).toContain('People executive summary');
    expect(html).toContain('Community executive summary');
    expect(html).not.toContain('Mass intentions executive summary');
    expect(html).not.toContain('Pastoral executive summary');
  });

  it('renders each module executive summary from that module snapshot', () => {
    executiveDashboard.getExecutive.mockReturnValue(
      of(
        buildExecutiveDashboardFixture({
          celebrations: {
            state: 'ready',
            data: { week_label: '28 Sep 2026 – 4 Oct 2026', week_start: '2026-09-28', week_end: '2026-10-04', birthdays_count: 2, anniversaries_count: 1, drilldown: 'members.directory' },
          },
          mass_intentions: {
            state: 'ready',
            data: {
              open: 4,
              registered_this_month: 3,
              registered_from: '2026-09-01',
              registered_to: '2026-10-01',
              needs_a_mass: 2,
              needs_a_tick: 1,
              schedule_attention: 0,
            },
          },
          worship: {
            state: 'ready',
            data: {
              next_mass: { id: 'm1', starts_at: '2026-10-01T09:00:00+05:30', celebrated_on: '2026-10-01', celebrated_at: '09:00' },
              upcoming: [],
              this_week_masses: 6,
              drilldown: 'mass.home',
            },
          },
          pastoral: { state: 'ready', data: { open_count: 5, assigned_count: 2, drilldown: 'dashboard.operations' } },
          snapshot: {
            state: 'ready',
            data: {
              cards: {
                families: { active_families: 8, total_families: 10, drilldown: 'families.directory' },
                members: { active_members: 22, total_members: 25, members_added_this_month: 3, drilldown: 'members.directory' },
                sacraments: { total_period: 40, this_month: 6, period_label: 'All time', top_types: [], more_types_count: 0, drilldown: 'sacraments.home' },
                ministries: {
                  active_ministries: 3,
                  active_associations: 2,
                  active_other: 1,
                  active_groups_total: 6,
                  groups_by_type: [
                    { code: 'ministry', name: 'Ministry', count: 3 },
                    { code: 'association', name: 'Association', count: 2 },
                    { code: 'choir', name: 'Choir', count: 1 },
                  ],
                  groups_by_category: [{ code: 'spiritual', name: 'Spiritual', count: 4 }],
                  active_memberships: 18,
                  vacancies: 4,
                  expiring_soon_count: 1,
                  drilldown: 'ministries.home',
                },
              },
            },
          },
        })
      )
    );

    fixture.detectChanges();
    const html = fixture.nativeElement.textContent as string;
    expect(html).toContain('People executive summary');
    expect(html).toContain('Birthdays');
    expect(html).toContain('Sacraments executive summary');
    expect(html).toContain('In period');
    expect(html).toContain('Ministry executive summary');
    expect(html).toContain('Active groups');
    expect(html).toContain('Choir');
    expect(html).toContain('Vacancies');
    expect(html).toContain('Mass intentions executive summary');
    expect(html).toContain('Needs a Mass');
    expect(html).toContain('Worship executive summary');
    expect(html).toContain('This week');
    expect(html).toContain('Pastoral executive summary');
    expect(html).toContain('Open requests');
    expect(html).not.toContain('Collections trend');

    const columns = fixture.componentInstance.executiveColumns();
    expect(columns[0].map((block) => block.key)).toContain('pastoral');
    expect(columns[1].map((block) => block.key)).not.toContain('pastoral');
  });

  it('shows registry error state instead of zero counts when executive snapshot fails', () => {
    executiveDashboard.getExecutive.mockReturnValue(throwError(() => ({ status: 500 })));

    fixture.detectChanges();

    const html = fixture.nativeElement.textContent;
    expect(html).toContain('Unable to load this section');
    expect(fixture.componentInstance.registryState).toBe('error');
    expect(fixture.nativeElement.querySelector('.cd-snapshot-card')).toBeNull();
  });

  it('does not render the dummy dashboard search field', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Search members, events, volunteers');
    expect(fixture.nativeElement.querySelector('.cd-page-header__search')).toBeNull();
  });
});
