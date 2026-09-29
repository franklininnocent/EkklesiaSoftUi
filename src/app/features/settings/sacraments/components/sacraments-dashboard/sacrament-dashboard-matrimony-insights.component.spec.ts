jest.mock('chart.js/auto', () => ({
  Chart: jest.fn().mockImplementation(() => ({ destroy: jest.fn() })),
}));

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Chart } from 'chart.js/auto';
import { SacramentDashboardMatrimonyInsightsComponent } from './sacrament-dashboard-matrimony-insights.component';
import { SacramentDashboardMatrimony } from '../../models/sacrament-dashboard.model';

function buildMatrimony(overrides: Partial<SacramentDashboardMatrimony> = {}): SacramentDashboardMatrimony {
  return {
    count: 1,
    sacrament_type_id: 8,
    bride_avg_age: 27,
    groom_avg_age: 29,
    bride_min_age: 25,
    bride_max_age: 29,
    groom_min_age: 27,
    groom_max_age: 31,
    age_brackets: {
      bride: [
        { key: '18_25', label: '18–25', count: 0 },
        { key: '26_30', label: '26–30', count: 1 },
      ],
      groom: [
        { key: '18_25', label: '18–25', count: 0 },
        { key: '26_30', label: '26–30', count: 1 },
      ],
    },
    parish_origins: [
      { parish: 'St Mary', role: 'bride', count: 1 },
      { parish: 'St Joseph', role: 'groom', count: 1 },
    ],
    inter_parish_count: 1,
    canonical_classification: {
      both_catholic: 0,
      mixed_marriage: 0,
      disparity_of_cult: 0,
      other: 0,
      unspecified: 1,
    },
    ...overrides,
  };
}

describe('SacramentDashboardMatrimonyInsightsComponent', () => {
  let component: SacramentDashboardMatrimonyInsightsComponent;
  let fixture: ComponentFixture<SacramentDashboardMatrimonyInsightsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SacramentDashboardMatrimonyInsightsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SacramentDashboardMatrimonyInsightsComponent);
    component = fixture.componentInstance;
    component.matrimony = buildMatrimony();
    component.periodLabel = 'Last 12 months';
    (Chart as unknown as jest.Mock).mockClear();
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as CanvasRenderingContext2D);
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders KPI metrics and section title', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Marriage insights');
    expect(fixture.nativeElement.textContent).toContain('Bride average age');
    expect(fixture.nativeElement.textContent).toContain('27');
    expect(fixture.nativeElement.textContent).toContain('Inter-parish');
  });

  it('creates grouped age, parish, and canonical charts when data exists', () => {
    fixture.detectChanges();

    expect(component.hasAgeData).toBe(true);
    expect(component.hasParishData).toBe(true);
    expect(component.hasCanonicalData).toBe(true);
    expect((Chart as unknown as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('shows contextual empty states when there are no marriages', () => {
    component.matrimony = buildMatrimony({
      count: 0,
      bride_avg_age: null,
      groom_avg_age: null,
      inter_parish_count: 0,
      age_brackets: {
        bride: [{ key: '18_25', label: '18–25', count: 0 }],
        groom: [{ key: '18_25', label: '18–25', count: 0 }],
      },
      parish_origins: [],
      canonical_classification: {
        both_catholic: 0,
        mixed_marriage: 0,
        disparity_of_cult: 0,
        other: 0,
        unspecified: 0,
      },
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No marriages recorded in this period.');
    expect(fixture.nativeElement.querySelectorAll('canvas').length).toBe(0);
  });

  it('shows a wider-period hint when marriages exist outside the selected period', () => {
    component.matrimony = buildMatrimony({ count: 0 });
    component.marriagesAllTime = 2;
    component.periodLabel = 'Year to date';
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Choose a wider period');
    expect(fixture.nativeElement.textContent).toContain('Last 12 months');
  });

  it('emits changePeriod when a wider-period action is selected', () => {
    const changePeriod = jest.fn();
    component.matrimony = buildMatrimony({ count: 0 });
    component.marriagesAllTime = 1;
    component.changePeriod.subscribe(changePeriod);
    fixture.detectChanges();

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const last12Button = buttons.find((button) => button.textContent?.includes('Last 12 months'));
    last12Button?.click();

    expect(changePeriod).toHaveBeenCalledWith('last12');
  });

  it('emits viewRegister when the action button is clicked', () => {
    const viewRegister = jest.fn();
    component.viewRegister.subscribe(viewRegister);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button');
    button?.click();

    expect(viewRegister).toHaveBeenCalled();
  });

  it('renders the age chart when averages exist but bucket counts are zero', () => {
    component.matrimony = buildMatrimony({
      bride_avg_age: 17,
      groom_avg_age: 17,
      bride_min_age: 17,
      bride_max_age: 17,
      groom_min_age: 17,
      groom_max_age: 17,
      age_brackets: {
        bride: [
          { key: '18_25', label: '18–25', count: 0 },
          { key: '26_30', label: '26–30', count: 0 },
        ],
        groom: [
          { key: '18_25', label: '18–25', count: 0 },
          { key: '26_30', label: '26–30', count: 0 },
        ],
      },
    });
    fixture.detectChanges();

    expect(component.hasAgeData).toBe(true);
    expect(fixture.nativeElement.textContent).not.toContain(
      'No bride or groom age data recorded for marriages in this period.'
    );
    expect(fixture.nativeElement.querySelector('canvas')).not.toBeNull();
  });

  it('shows the missing age empty state only when no age metrics exist', () => {
    component.matrimony = buildMatrimony({
      count: 2,
      bride_avg_age: null,
      groom_avg_age: null,
      bride_min_age: null,
      bride_max_age: null,
      groom_min_age: null,
      groom_max_age: null,
      parish_origins: [],
      canonical_classification: {
        both_catholic: 0,
        mixed_marriage: 0,
        disparity_of_cult: 0,
        other: 0,
        unspecified: 0,
      },
      age_brackets: {
        bride: [
          { key: '18_25', label: '18–25', count: 0 },
          { key: '26_30', label: '26–30', count: 0 },
        ],
        groom: [
          { key: '18_25', label: '18–25', count: 0 },
          { key: '26_30', label: '26–30', count: 0 },
        ],
      },
    });
    fixture.detectChanges();

    expect(component.hasAgeData).toBe(false);
    expect(fixture.nativeElement.textContent).toContain(
      'No bride or groom age data recorded for marriages in this period.'
    );
    expect(fixture.nativeElement.querySelector('.matrimony-insights__card--primary canvas')).toBeNull();
  });

  it('shows bride and groom age ranges when min and max differ', () => {
    component.matrimony = buildMatrimony({
      bride_min_age: 24,
      bride_max_age: 29,
      groom_min_age: 27,
      groom_max_age: 31,
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Range 24–29');
    expect(fixture.nativeElement.textContent).toContain('Range 27–31');
  });
});
