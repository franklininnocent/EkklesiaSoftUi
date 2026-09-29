import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChurchCurrencyService } from '@core/services/church-currency.service';
import { ExecutiveSummaryVisualsComponent } from './executive-summary-visuals.component';
import { ExecutiveReportSummary } from '../../models/donation.model';
import { REPORT_DRILL_DOWN_GRAPH_IDS } from './report-drill-down.constants';

describe('ExecutiveSummaryVisualsComponent', () => {
  let fixture: ComponentFixture<ExecutiveSummaryVisualsComponent>;

  const summary: ExecutiveReportSummary = {
    title: 'Executive Stewardship Summary',
    narrative: 'Strong participation at 33%. Collections are on track.',
    highlights: [],
    recommended_actions: ['Review families requiring attention on the Financial Dashboard.'],
    metrics: {
      health_score: 44,
      health_status: 'attention',
      current_month_collected: 200,
      pending_dues: 39823556,
      participation_rate: 33.2,
      forecast_projection: 222.22
    },
    forecast_narrative: 'Based on the last 3 months, collections are averaging a modest amount.',
    visuals: {
      health: {
        score: 44,
        label: 'Attention Needed',
        status: 'attention',
        factors: [
          { key: 'family_engagement', label: 'Family engagement', score: 33.2, weight_pct: 35 },
          { key: 'overdue_health', label: 'Overdue balance health', score: 50, weight_pct: 30 },
          { key: 'project_funding', label: 'Project funding', score: 40, weight_pct: 20 },
          { key: 'growth_health', label: 'Collection growth health', score: 50, weight_pct: 15 }
        ],
        story: {
          performing: [
            { key: 'collected', label: 'Collected this month', value: 200, value_kind: 'money' },
            { key: 'growth', label: 'Growth vs same days last month', value: 33.3, value_kind: 'percent' },
            { key: 'participation', label: 'Family participation (90 days)', value: 33.2, value_kind: 'percent' }
          ],
          attention: [
            { key: 'overdue_amount', label: 'Overdue', value: 1000, value_kind: 'money' },
            { key: 'overdue_families', label: 'Families overdue', value: 2782, value_kind: 'count' }
          ],
          pending: [
            { key: 'remaining_collectable', label: 'Remaining collectable (not overdue)', value: 39822556, value_kind: 'money' },
            { key: 'next_14_days', label: 'Due in the next 14 days', value: 500, value_kind: 'money' }
          ],
          opportunity: [
            {
              key: 'upcoming_dues',
              label: '2782 families have dues due in the next 14 days',
              value: 12,
              value_kind: 'count'
            }
          ]
        }
      },
      collections: {
        current_month_collected: 200,
        previous_month_collected: 150,
        collection_growth_pct: 33.3
      },
      collection_snapshot: {
        expected: 500,
        collected: 200,
        outstanding: 39823556,
        collection_rate_pct: 40,
        has_assessment: true,
        collected_label: 'due_allocated'
      },
      outstanding: {
        pending_dues: 39823556,
        overdue_amount: 1000,
        remaining_collectable: 39822556,
        overdue_family_count: 2782,
        next_14_days_amount: 500,
        next_14_days_family_count: 12,
        later_remaining_amount: 39821056,
        later_remaining_family_count: 2700
      },
      participation: {
        active_families: 100,
        participating_families: 33,
        participation_rate: 33,
        window_days: 90
      },
      collection_trend: [
        { period: '2025-01', label: 'Jan 2025', collected: 100 },
        { period: '2025-02', label: 'Feb 2025', collected: 120 }
      ],
      forecast: {
        history: [
          { period: '2025-01', label: 'Jan 2025', collected: 100 },
          { period: '2025-02', label: 'Feb 2025', collected: 120 }
        ],
        current_month_collected: 200,
        current_month_projection: 222.22,
        daily_pace: 10,
        collection_growth_pct: 5
      }
    }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExecutiveSummaryVisualsComponent],
      providers: [
        {
          provide: ChurchCurrencyService,
          useValue: {
            currencyCode: () => 'INR',
            formatAmount: (v: number) => `INR ${v}`
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ExecutiveSummaryVisualsComponent);
    fixture.componentInstance.summary = summary;
    fixture.detectChanges();
  });

  it('renders health status label', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Needs attention');
    expect(el.textContent).toContain('Stewardship health');
    expect(el.textContent).toContain('Collection snapshot');
    expect(el.textContent).toContain('Health drivers');
  });

  it('keeps methodology copy collapsed until the help control is opened', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('not full parish financial position');
    const help = el.querySelector('.exec-visuals__health-help') as HTMLButtonElement;
    expect(help.getAttribute('aria-expanded')).toBe('false');
    help.click();
    fixture.detectChanges();
    expect(el.textContent).toContain('not full parish financial position');
    expect(help.getAttribute('aria-expanded')).toBe('true');
  });

  it('distinguishes overdue families from upcoming-due families without the API sentence', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Overdue families');
    expect(el.textContent).toContain('Past due');
    expect(el.textContent).toContain('Families with upcoming dues');
    expect(el.textContent).toContain('Not overdue — due in the next 14 days');
    expect(el.textContent).not.toContain('have dues due in the next 14 days');
    expect(el.textContent).toContain('Of that, due in 14 days');
  });

  it('always renders the four stewardship states', () => {
    const states = fixture.nativeElement.querySelectorAll('.exec-visuals__state');
    expect(states.length).toBe(4);
    expect(fixture.nativeElement.textContent).toContain('Performing');
    expect(fixture.nativeElement.textContent).toContain('Attention');
    expect(fixture.nativeElement.textContent).toContain('Pending');
    expect(fixture.nativeElement.textContent).toContain('Opportunity');
  });

  it('shows empty-state copy when an opportunity bucket has no items', () => {
    const emptySummary: ExecutiveReportSummary = {
      ...summary,
      visuals: {
        ...summary.visuals!,
        health: {
          ...summary.visuals!.health,
          story: {
            performing: [],
            attention: [],
            pending: [],
            opportunity: []
          }
        }
      }
    };
    fixture.componentInstance.summary = emptySummary;
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('No upcoming-due families or near-goal projects');
    expect(el.textContent).toContain('No overdue balances');
  });

  it('renders collection snapshot bar chart canvas', () => {
    const canvas = fixture.nativeElement.querySelector('.exec-visuals__snapshot canvas');
    expect(canvas).toBeTruthy();
  });

  it('formats money via church currency helper', () => {
    expect(fixture.componentInstance.formatMoney(200)).toContain('200');
  });

  it('emits drill-down for financial health factor keyboard target', () => {
    const spy = jasmine.createSpy('drillDownRequested');
    fixture.componentInstance.drillDownRequested.subscribe(spy);
    fixture.componentInstance.openDrill('financial_health', 'growth_health', 'growth_health');
    expect(spy).toHaveBeenCalledWith({
      graph_id: 'financial_health',
      data_element_id: 'growth_health',
      slice_id: 'growth_health'
    });
  });

  it('emits overall_score drill-down when the health score control is activated', () => {
    const spy = jasmine.createSpy('drillDownRequested');
    fixture.componentInstance.drillDownRequested.subscribe(spy);
    const scoreBtn = fixture.nativeElement.querySelector('.exec-visuals__health-score') as HTMLButtonElement;
    expect(scoreBtn).toBeTruthy();
    scoreBtn.click();
    expect(spy).toHaveBeenCalledWith({
      graph_id: 'financial_health',
      data_element_id: 'overall_score',
      slice_id: 'overall_score'
    });
  });

  it('emits upcoming-dues drill-down from the opportunity metric', () => {
    const spy = jasmine.createSpy('drillDownRequested');
    fixture.componentInstance.drillDownRequested.subscribe(spy);
    const opportunity = fixture.nativeElement.querySelector('[data-state="opportunity"] .exec-visuals__state-metric') as HTMLButtonElement;
    expect(opportunity).toBeTruthy();
    opportunity.click();
    expect(spy).toHaveBeenCalledWith({
      graph_id: 'outstanding_overdue',
      data_element_id: 'next_14_days_amount',
      slice_id: 'upcoming_14d'
    });
  });

  it('emits drill-down when a health factor row is clicked', () => {
    const spy = jasmine.createSpy('drillDownRequested');
    fixture.componentInstance.drillDownRequested.subscribe(spy);
    const factorBtn = fixture.nativeElement.querySelector('.exec-visuals__factor-btn') as HTMLButtonElement;
    factorBtn.click();
    expect(spy).toHaveBeenCalledWith({
      graph_id: 'financial_health',
      data_element_id: 'family_engagement',
      slice_id: 'family_engagement'
    });
  });

  it('covers all leadership graph ids via openDrill', () => {
    const spy = jasmine.createSpy('drillDownRequested');
    fixture.componentInstance.drillDownRequested.subscribe(spy);

    const samples: Array<{ graph_id: (typeof REPORT_DRILL_DOWN_GRAPH_IDS)[number]; data_element_id: string; slice_id: string }> = [
      { graph_id: 'collections', data_element_id: 'current_month_collected', slice_id: 'current_month' },
      { graph_id: 'collection_snapshot', data_element_id: 'expected', slice_id: 'expected' },
      { graph_id: 'collection_trend', data_element_id: 'collected', slice_id: '2025-02' },
      { graph_id: 'family_participation', data_element_id: 'participating_families', slice_id: 'participating' },
      { graph_id: 'outstanding_overdue', data_element_id: 'overdue_amount', slice_id: 'overdue' },
      { graph_id: 'month_end_forecast', data_element_id: 'current_month_projection', slice_id: 'current_month_projection' },
      { graph_id: 'financial_health', data_element_id: 'overall_score', slice_id: 'overall_score' }
    ];

    expect(samples.length).toBe(REPORT_DRILL_DOWN_GRAPH_IDS.length);
    for (const payload of samples) {
      fixture.componentInstance.openDrill(payload.graph_id, payload.data_element_id, payload.slice_id);
    }
    expect(spy).toHaveBeenCalledTimes(REPORT_DRILL_DOWN_GRAPH_IDS.length);
  });

  it('exposes keyboard-accessible forecast projection control', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Projected month-end');
  });

  it('renders only stewardship health when visualScope is health', () => {
    fixture.componentInstance.visualScope = 'health';
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Stewardship health');
    expect(el.textContent).not.toContain('Collection snapshot');
    expect(el.querySelector('.exec-visuals__snapshot canvas')).toBeNull();
  });

  it('omits stewardship health when visualScope is charts', () => {
    fixture.componentInstance.visualScope = 'charts';
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('Stewardship health');
    expect(el.textContent).toContain('Collection snapshot');
  });

  it('renders dashboard scope with health and overview charts but not collection trend', () => {
    fixture.componentInstance.visualScope = 'dashboard';
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Stewardship health');
    expect(el.textContent).toContain('Collection snapshot');
    expect(el.textContent).not.toContain('Collection trend');
  });

  it('renders reports scope without overview charts', () => {
    fixture.componentInstance.visualScope = 'reports';
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('Stewardship health');
    expect(el.textContent).not.toContain('Collection snapshot');
    expect(el.textContent).toContain('Collection trend');
  });
});
