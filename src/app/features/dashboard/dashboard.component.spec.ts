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
import { DashboardComponent } from './dashboard.component';

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
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
  });

  it('does not call tenant module-status for EkklesiaAdmin without parish context', () => {
    auth.canAccessMinistries.mockReturnValue(false);

    fixture.detectChanges();

    expect(ministriesApi.getModuleStatus).not.toHaveBeenCalled();
  });

  it('calls tenant module-status when platform admin has an active support session', () => {
    supportSessionId = 'session-live';
    auth.canAccessMinistries.mockReturnValue(true);

    fixture.detectChanges();

    expect(ministriesApi.getModuleStatus).toHaveBeenCalled();
  });
});

describe('DashboardComponent (Stewardship Hub)', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let donationsService: { getOperationsDashboard: jest.Mock };
  let auth: {
    canAccessDonations: jest.Mock;
    canAccessMinistries: jest.Mock;
    canAccessPastoral: jest.Mock;
    hasPermission: jest.Mock;
    isSuperAdmin: jest.Mock;
    isPlatformActor: jest.Mock;
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
    expect(html).toContain('Active Families');
    expect(fixture.componentInstance.financialHubState).toBe('ready');
  });

  it('uses month-over-month change for collections KPI instead of health label', () => {
    fixture.detectChanges();

    const collectionsKpi = fixture.componentInstance.heroKpis.find((kpi) => kpi.id === 'collections');
    expect(collectionsKpi).toBeDefined();
    expect(collectionsKpi?.change).toBe('+88%');
    expect(collectionsKpi?.change).not.toBe('Healthy');
  });

  it('shows unauthorized copy without amounts when donations access is denied', () => {
    auth.canAccessDonations.mockReturnValue(false);

    fixture.detectChanges();

    const html = fixture.nativeElement.textContent;
    expect(html).toContain('Giving totals are available to people who can view Donations.');
    expect(html).not.toContain('$168,400');
    expect(donationsService.getOperationsDashboard).not.toHaveBeenCalled();
  });

  it('shows error state without demo money when the API fails', () => {
    donationsService.getOperationsDashboard.mockReturnValue(throwError(() => ({ status: 500 })));

    fixture.detectChanges();

    const html = fixture.nativeElement.textContent;
    expect(html).toContain('Couldn’t load giving totals.');
    expect(html).not.toContain('$168,400');
    expect(fixture.componentInstance.financialHubState).toBe('error');
  });

  it('renders visible currency amounts under giving trend bars', () => {
    fixture.detectChanges();

    const amounts = Array.from(
      fixture.nativeElement.querySelectorAll('.cd-chart__amount') as NodeListOf<HTMLElement>
    ).map((el) => el.textContent?.trim());

    expect(amounts.length).toBe(6);
    expect(amounts).toContain('₹1,500');
    expect(amounts).toContain('₹0');
    expect(fixture.nativeElement.textContent).toContain('as of 2026-09-30');
    expect(fixture.nativeElement.textContent).not.toContain('No collections in the last 6 months yet.');
  });

  it('keeps six month labels and shows empty caption when all trend values are zero', () => {
    donationsService.getOperationsDashboard.mockReturnValue(
      of({
        success: true,
        data: {
          ...liveOpsPayload.data,
          collection_trend: [
            { period: '2026-04', label: 'Apr 2026', collected: 0 },
            { period: '2026-05', label: 'May 2026', collected: 0 },
            { period: '2026-06', label: 'Jun 2026', collected: 0 },
            { period: '2026-07', label: 'Jul 2026', collected: 0 },
            { period: '2026-08', label: 'Aug 2026', collected: 0 },
            { period: '2026-09', label: 'Sep 2026', collected: 0 },
          ],
          collections_by_method_this_month: {},
          financial: {
            ...liveOpsPayload.data.financial,
            totals: {
              ...liveOpsPayload.data.financial.totals,
              current_month_collected: 0,
            },
          },
        },
      })
    );

    fixture.detectChanges();

    const html = fixture.nativeElement.textContent;
    expect(html).toContain('No collections in the last 6 months yet.');
    expect(html).toContain('Apr');
    expect(html).toContain('Sep');
    expect(fixture.nativeElement.querySelectorAll('.cd-chart__amount').length).toBe(6);
  });
});

describe('DashboardComponent (Overview metrics)', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let familyService: { getStatistics: jest.Mock };
  let bccService: { getStatistics: jest.Mock };
  let auth: {
    canAccessDonations: jest.Mock;
    canAccessMinistries: jest.Mock;
    canAccessPastoral: jest.Mock;
    hasPermission: jest.Mock;
    isSuperAdmin: jest.Mock;
    isPlatformActor: jest.Mock;
  };

  const tenantUser = {
    id: 3,
    name: 'Parish Staff',
    tenant_id: 11,
    role_name: 'Administrator',
  };

  beforeEach(async () => {
    familyService = {
      getStatistics: jest.fn(() => of(familyStatsFixture)),
    };
    bccService = {
      getStatistics: jest.fn(() => of(bccStatsFixture)),
    };
    auth = {
      canAccessMinistries: jest.fn(() => false),
      canAccessDonations: jest.fn(() => false),
      canAccessPastoral: jest.fn(() => false),
      hasPermission: jest.fn(() => false),
      isSuperAdmin: jest.fn(() => false),
      isPlatformActor: jest.fn(() => false),
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
        { provide: FamilyService, useValue: familyService },
        { provide: BCCService, useValue: bccService },
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
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
  });

  it('renders live growth and life group metrics without demo placeholders', () => {
    fixture.detectChanges();

    const html = fixture.nativeElement.textContent;
    expect(html).not.toContain('47');
    expect(html).not.toContain('78%');
    expect(html).not.toContain('Assimilation Progress');
    expect(html).not.toContain('Visitors to Active');
    expect(html).toContain('New Member Sign-ups');
    expect(html).toContain('Families Not in a Life Group');
    expect(html).toContain('Family coverage');
    expect(html).toContain('40%');
    expect(fixture.componentInstance.lifeGroups[0].value).toBe('0');
  });

  it('shows registry error state instead of zero counts when family stats fail', () => {
    familyService.getStatistics.mockReturnValue(throwError(() => ({ status: 500 })));

    fixture.detectChanges();

    const html = fixture.nativeElement.textContent;
    expect(html).toContain('Couldn’t load parish counts.');
    expect(fixture.componentInstance.registryState).toBe('error');
    expect(fixture.nativeElement.querySelector('.cd-registry__card')).toBeNull();
  });

  it('does not render the dummy dashboard search field', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Search members, events, volunteers');
    expect(fixture.nativeElement.querySelector('.cd-page-header__search')).toBeNull();
  });
});
