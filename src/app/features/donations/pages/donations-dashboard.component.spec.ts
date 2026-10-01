import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, EMPTY } from 'rxjs';
import { ChurchCurrencyService } from '@core/services/church-currency.service';
import { EntitlementService } from '@core/services/entitlement.service';
import { DonationDashboardSummary } from '../models/donation.model';
import { DonationsService } from '../services/donations.service';
import { QuickCollectService } from '../services/quick-collect.service';
import { DonationsDashboardComponent } from './donations-dashboard.component';

function snapshotSummary(overrides: Partial<DonationDashboardSummary['snapshot']> = {}): DonationDashboardSummary {
  return {
    totals: {
      collected: 0,
      refunded: 0,
      net: 0,
      pending_dues: 0,
      active_projects: 0
    },
    collections_by_method: {},
    collection_trend: [],
    snapshot: {
      as_of: '2026-09-27',
      timezone: 'Asia/Kolkata',
      financial_year: 'FY 2026–27',
      financial_year_key: '2026',
      financial_year_start: '2026-04-01',
      financial_year_end: '2027-03-31',
      month: {
        collected: 0,
        comparison_start: '2026-08-01',
        comparison_end: '2026-08-27',
        comparison_collected: 0,
        growth_pct: null
      },
      fiscal_year_collected: 0,
      outstanding_contributions: 0,
      overdue_amount: 0,
      overdue_families: 0,
      due_next_14_days_amount: 0,
      due_next_14_days_families: 0,
      participation: {
        participating: 0,
        active: 0,
        rate: 0,
        window_start: '2026-06-30',
        window_end: '2026-09-27',
        not_participating: 0,
        net_change_vs_prior_window: 0
      },
      giving_mix: {
        buckets: [
          { key: 'contribution_dues', label: 'Contribution dues', amount: 0 },
          { key: 'projects', label: 'Projects', amount: 0 },
          { key: 'voluntary', label: 'Voluntary gifts', amount: 0 },
          { key: 'other', label: 'Other', amount: 0 }
        ],
        unallocated: 0,
        reconciled: true
      },
      project_installments: { overdue: 0, not_yet_due: 0, open: 0 },
      active_project_count: 0,
      projects: [],
      attention_families: [],
      recent_payments: [],
      ...overrides
    }
  };
}

describe('DonationsDashboardComponent', () => {
  let fixture: ComponentFixture<DonationsDashboardComponent>;

  async function render(summary: DonationDashboardSummary): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [DonationsDashboardComponent],
      providers: [
        provideRouter([]),
        {
          provide: DonationsService,
          useValue: {
            getDashboardSummary: jest.fn().mockReturnValue(of({ success: true, data: summary })),
            getExecutiveReportSummary: jest.fn().mockReturnValue(of(null)),
            ledgerMutated$: EMPTY,
          }
        },
        { provide: QuickCollectService, useValue: { open: jest.fn() } },
        { provide: ChurchCurrencyService, useValue: { currencyCode: () => 'INR' } },
        { provide: EntitlementService, useValue: { load: () => of(null), hasFeature: () => false } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DonationsDashboardComponent);
    fixture.detectChanges();
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('shows the five snapshot measures and omits misleading labels', async () => {
    await render(snapshotSummary());
    const text = fixture.nativeElement.textContent as string;

    expect(fixture.nativeElement.querySelector('.dashboard-kpi--collected-month')).toBeTruthy();
    expect(text).toContain('Succeeded payments · month to date');
    expect(text).toContain('Collected this month');
    expect(text).toContain('Same days last month');
    expect(text).toContain('This month');
    expect(text).toContain('This fiscal year');
    expect(text).toContain('Outstanding contributions');
    expect(text).toContain('Overdue');
    expect(text).toContain('Family participation');
    expect(fixture.nativeElement.querySelector('.dashboard-kpi--participation')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.dashboard-kpi--participation')).toBeTruthy();
    expect(text).not.toContain('Net Position');
    expect(text).not.toContain('Financial Health Score');
    expect(text).not.toContain('Inactive families');
    expect(text).toContain('0.00');
    expect(text).not.toContain('What needs a decision');
    expect(text).toContain('No collections yet');
  });

  it('links the overdue KPI to the dues register', async () => {
    await render(snapshotSummary());
    const overdueKpi = fixture.nativeElement.querySelector('.dashboard-kpi--overdue') as HTMLAnchorElement;
    expect(overdueKpi?.getAttribute('href')).toContain('dues');
    expect(overdueKpi?.getAttribute('href')).toContain('overdue_only=1');
  });

  it('hides the giving mix when it does not reconcile', async () => {
    const summary = snapshotSummary();
    summary.snapshot!.month.collected = 100;
    summary.snapshot!.fiscal_year_collected = 100;
    summary.snapshot!.giving_mix = {
      ...summary.snapshot!.giving_mix,
      reconciled: false,
      buckets: [{ key: 'contribution_dues', label: 'Contribution dues', amount: 40 }]
    };

    await render(summary);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Giving mix is hidden');
    expect(text).not.toContain('Contribution dues');
  });

  it('shows one giving-mix amount when only one bucket is non-zero', async () => {
    const summary = snapshotSummary();
    summary.snapshot!.fiscal_year_collected = 80;
    summary.snapshot!.giving_mix.buckets = [
      { key: 'contribution_dues', label: 'Contribution dues', amount: 80 },
      { key: 'projects', label: 'Projects', amount: 0 },
      { key: 'voluntary', label: 'Voluntary gifts', amount: 0 },
      { key: 'other', label: 'Other', amount: 0 }
    ];

    await render(summary);
    expect(fixture.nativeElement.textContent).toContain('Contribution dues');
    expect(fixture.nativeElement.querySelector('.dashboard-mix')).toBeNull();
  });
});
