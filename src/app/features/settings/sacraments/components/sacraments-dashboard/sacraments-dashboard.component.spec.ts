jest.mock('chart.js/auto', () => ({
  Chart: jest.fn().mockImplementation(() => ({ destroy: jest.fn() })),
}));

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, NEVER } from 'rxjs';
import { SacramentsDashboardComponent } from './sacraments-dashboard.component';
import { SacramentService } from '../../services/sacrament.service';
import { BCCService } from '@core/services/bcc.service';
import { SacramentDashboardSummary } from '../../models/sacrament-dashboard.model';

function buildSummary(overrides: Partial<SacramentDashboardSummary> = {}): SacramentDashboardSummary {
  return {
    period: {
      date_from: '2025-01-01',
      date_to: '2025-12-31',
      label: 'Year to date',
    },
    kpis: {
      total_period: 3,
      total_all_time: 8,
      this_month: 1,
      monthly_average: 1,
      yoy_growth_pct: 10,
      by_type: [
        {
          sacrament_type_id: 1,
          code: 'BAPTISM',
          label: 'Baptism',
          period: 2,
          all_time: 5,
          yoy_pct: 0,
        },
      ],
    },
    trends: {
      granularity: 'month',
      start: '2025-01',
      end: '2025-12',
      series: [
        {
          code: 'BAPTISM',
          label: 'Baptism',
          points: [{ period: '2025-06', label: 'Jun', count: 2 }],
        },
      ],
    },
    breakdowns: {
      member_status: { member: 2, non_member: 1, unknown: 0 },
      by_type_totals: [{ code: 'BAPTISM', label: 'Baptism', count: 2 }],
    },
    demographics: {
      gender_by_type: [
        {
          code: 'BAPTISM',
          label: 'Baptism',
          sacrament_type_id: 1,
          male: 1,
          female: 1,
          other: 0,
          unknown: 0,
        },
      ],
      age_by_type: [
        {
          code: 'BAPTISM',
          label: 'Baptism',
          sacrament_type_id: 1,
          with_age_data: 2,
          average_age: 8,
          min_age: 1,
          max_age: 12,
          buckets: [{ key: '0_6', label: '0–6', count: 1 }],
        },
      ],
      age_buckets: [{ key: '0_6', label: '0–6', count: 1 }],
    },
    matrimony: null,
    recent: [
      {
        id: 10,
        recipient_name: 'Jane Doe',
        date_administered: '2025-06-15',
        status: 'registered',
        type: { id: 1, name: 'Baptism', code: 'BAPTISM' },
      },
    ],
    meta: {
      restricted_types_excluded: [],
      generated_at: new Date().toISOString(),
      duration_ms: 12,
      cached: false,
    },
    ...overrides,
  };
}

describe('SacramentsDashboardComponent', () => {
  let component: SacramentsDashboardComponent;
  let fixture: ComponentFixture<SacramentsDashboardComponent>;
  let router: Router;
  let getDashboardSummary: jest.Mock;
  let getBCCs: jest.Mock;

  beforeEach(async () => {
    getDashboardSummary = jest.fn(() =>
      of({
        success: true,
        data: buildSummary(),
      })
    );
    getBCCs = jest.fn(() =>
      of({
        success: true,
        data: [{ id: 'bcc-1', name: 'St Joseph', tenant_id: '1', bcc_code: 'BCC001' }],
        total: 1,
        current_page: 1,
        last_page: 1,
        per_page: 500,
        from: 1,
        to: 1,
      })
    );

    await TestBed.configureTestingModule({
      imports: [SacramentsDashboardComponent],
      providers: [
        provideRouter([]),
        {
          provide: SacramentService,
          useValue: { getDashboardSummary },
        },
        {
          provide: BCCService,
          useValue: { getBCCs },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SacramentsDashboardComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  it('shows loading skeleton before summary loads', () => {
    getDashboardSummary.mockReturnValueOnce(NEVER);
    fixture.detectChanges();

    expect(component.loading).toBe(true);
    expect(component.summary).toBeNull();
    expect(fixture.nativeElement.querySelector('app-loading-skeleton')).toBeTruthy();
  });

  it('renders KPI data after load', () => {
    fixture.detectChanges();

    expect(getDashboardSummary).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Total in period');
    expect(fixture.nativeElement.textContent).toContain('3');
  });

  it('defaults to all-time period on initial load', () => {
    fixture.detectChanges();

    expect(component.periodPreset).toBe('all');
    expect(getDashboardSummary).toHaveBeenCalledWith(
      expect.not.objectContaining({
        date_from: expect.anything(),
        date_to: expect.anything(),
      })
    );
  });

  it('reloads when period preset changes', () => {
    fixture.detectChanges();
    getDashboardSummary.mockClear();

    component.setPeriod('month');
    fixture.detectChanges();

    expect(component.periodPreset).toBe('month');
    expect(getDashboardSummary).toHaveBeenCalled();
  });

  it('navigates to register with drill-down filters', () => {
    fixture.detectChanges();
    component.openRegister({
      sacrament_type_id: 1,
      date_from: '2025-06-01',
      date_to: '2025-06-30',
    });

    expect(router.navigate).toHaveBeenCalledWith(['/sacraments/register'], {
      queryParams: {
        sacrament_type_id: 1,
        date_from: '2025-06-01',
        date_to: '2025-06-30',
      },
    });
  });

  it('navigates to register from trend point selection', () => {
    fixture.detectChanges();
    component.openTrendPoint({ period: '2025-06', label: 'Jun', count: 2 }, 'BAPTISM');

    expect(router.navigate).toHaveBeenCalledWith(['/sacraments/register'], {
      queryParams: {
        sacrament_type_id: 1,
        date_from: '2025-06-01',
        date_to: '2025-06-30',
      },
    });
  });

  it('navigates to register from aggregated trend point without sacrament filter', () => {
    fixture.detectChanges();
    component.openTrendPoint({ period: '2025-06', label: 'Jun', count: 2 }, null);

    expect(router.navigate).toHaveBeenCalledWith(['/sacraments/register'], {
      queryParams: {
        date_from: '2025-06-01',
        date_to: '2025-06-30',
      },
    });
  });

  it('reloads with BCC filter when community group changes', () => {
    fixture.detectChanges();
    getDashboardSummary.mockClear();

    component.onBccChange('bcc-1');
    fixture.detectChanges();

    expect(component.selectedBccId).toBe('bcc-1');
    expect(getDashboardSummary).toHaveBeenCalledWith(
      expect.objectContaining({ bcc_id: 'bcc-1' })
    );
  });

  it('reloads with marriage gap toggle', () => {
    fixture.detectChanges();
    getDashboardSummary.mockClear();

    component.setMarriageGaps(true);
    fixture.detectChanges();

    expect(getDashboardSummary).toHaveBeenCalledWith(
      expect.objectContaining({ include_marriage_gaps: true })
    );
  });

  it('passes BCC filter through register drill-down', () => {
    fixture.detectChanges();
    component.selectedBccId = 'bcc-1';
    component.openRegister({ sacrament_type_id: 1 });

    expect(router.navigate).toHaveBeenCalledWith(['/sacraments/register'], {
      queryParams: {
        sacrament_type_id: 1,
        bcc_id: 'bcc-1',
      },
    });
  });

  it('navigates to families with missing sacrament filter', () => {
    fixture.detectChanges();
    component.selectedBccId = 'bcc-1';
    component.openFamiliesMissing('BAPTISM');

    expect(router.navigate).toHaveBeenCalledWith(['/families'], {
      queryParams: {
        missing_sacrament: 'BAPTISM',
        bcc_id: 'bcc-1',
      },
    });
  });

  it('navigates to members for baptized without communion progression', () => {
    fixture.detectChanges();
    component.openMembersProgression('baptized_without_communion');

    expect(router.navigate).toHaveBeenCalledWith(['/members'], {
      queryParams: {
        progression: 'baptized_without_communion',
      },
    });
  });

  it('navigates to members for unmarried marriage-eligibility cohorts', () => {
    fixture.detectChanges();
    component.openMembersProgression('female_unmarried_over_18');

    expect(router.navigate).toHaveBeenCalledWith(['/members'], {
      queryParams: {
        progression: 'female_unmarried_over_18',
      },
    });
  });

  it('renders age distribution across all sacrament types without a panel selector', () => {
    getDashboardSummary.mockReturnValueOnce(
      of({
        success: true,
        data: buildSummary({
          demographics: {
            gender_by_type: [
              {
                code: 'BAPTISM',
                label: 'Baptism',
                sacrament_type_id: 1,
                male: 1,
                female: 1,
                other: 0,
                unknown: 0,
              },
              {
                code: 'EUCHARIST',
                label: 'Eucharist',
                sacrament_type_id: 2,
                male: 2,
                female: 0,
                other: 0,
                unknown: 0,
              },
            ],
            age_by_type: [
              {
                code: 'BAPTISM',
                label: 'Baptism',
                sacrament_type_id: 1,
                with_age_data: 2,
                average_age: 8,
                min_age: 1,
                max_age: 12,
                buckets: [{ key: '7_9', label: '7–9', count: 2 }],
              },
              {
                code: 'EUCHARIST',
                label: 'Eucharist',
                sacrament_type_id: 2,
                with_age_data: 1,
                average_age: 10,
                min_age: 10,
                max_age: 10,
                buckets: [{ key: '10_12', label: '10–12', count: 1 }],
              },
            ],
            age_buckets: [{ key: '7_9', label: '7–9', count: 2 }],
          },
        }),
      })
    );

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('All sacrament types');
    expect(fixture.nativeElement.textContent).toContain('Baptism');
    expect(fixture.nativeElement.textContent).toContain('Eucharist');
    expect(fixture.nativeElement.querySelector('.sacraments-dashboard__panel-head .sacraments-dashboard__type-toggle')).toBeNull();
  });

  it('renders gender distribution across all sacrament types without a sacrament selector', () => {
    getDashboardSummary.mockReturnValueOnce(
      of({
        success: true,
        data: buildSummary({
          demographics: {
            gender_by_type: [
              {
                code: 'BAPTISM',
                label: 'Baptism',
                sacrament_type_id: 1,
                male: 1,
                female: 1,
                other: 0,
                unknown: 0,
              },
              {
                code: 'HOLY_ORDERS',
                label: 'Holy Orders',
                sacrament_type_id: 7,
                male: 2,
                female: 0,
                other: 0,
                unknown: 0,
              },
              {
                code: 'EUCHARIST',
                label: 'Eucharist',
                sacrament_type_id: 2,
                male: 2,
                female: 0,
                other: 0,
                unknown: 0,
              },
            ],
            age_by_type: [],
            age_buckets: [],
          },
        }),
      })
    );

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Holy Orders');
    expect(fixture.nativeElement.textContent).toContain('Eucharist');
    expect(fixture.nativeElement.querySelector('.sacraments-dashboard__type-toggle--card')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toMatch(/Holy OrdersEucharist/);
  });

  it('syncs filter state to URL when period changes', () => {
    fixture.detectChanges();
    component.setPeriod('month');

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: expect.objectContaining({ period: 'month' }),
        replaceUrl: true,
      })
    );
  });
});
