jest.mock('chart.js/auto', () => ({
  Chart: jest.fn().mockImplementation(() => ({ destroy: jest.fn() })),
}));

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Chart } from 'chart.js/auto';
import { SacramentDashboardProgressionRadialChartComponent } from './sacrament-dashboard-progression-radial-chart.component';
import { SacramentDashboardGaps } from '../../models/sacrament-dashboard.model';

function progressionFixture(
  overrides: Partial<SacramentDashboardGaps['progression']> = {},
): SacramentDashboardGaps['progression'] {
  return {
    baptized_without_communion: { count: 0, eligible_count: 12 },
    baptized_without_confirmation: { count: 5, eligible_count: 8 },
    female_unmarried_over_18: { count: 2, eligible_count: 4 },
    male_unmarried_over_23: { count: 3, eligible_count: 6 },
    ...overrides,
  };
}

describe('SacramentDashboardProgressionRadialChartComponent', () => {
  let component: SacramentDashboardProgressionRadialChartComponent;
  let fixture: ComponentFixture<SacramentDashboardProgressionRadialChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SacramentDashboardProgressionRadialChartComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SacramentDashboardProgressionRadialChartComponent);
    component = fixture.componentInstance;
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

  it('renders a radial bar chart and legend rows', () => {
    fixture.componentRef.setInput('progression', progressionFixture());
    fixture.componentRef.setInput('progressionThreshold', 10);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Baptized but no First Communion (age 10+)');
    expect(fixture.nativeElement.textContent).toContain('Baptized but not confirmation (age 10+)');
    expect(fixture.nativeElement.textContent).toContain('Female (>18) - Not Married');
    expect(fixture.nativeElement.textContent).toContain('Male (>23) - Not Married');
    expect(fixture.nativeElement.textContent).toContain('5');
    expect(fixture.nativeElement.querySelector('canvas')).not.toBeNull();
    expect((Chart as unknown as jest.Mock).mock.calls.length).toBeGreaterThan(0);

    const chartConfig = (Chart as unknown as jest.Mock).mock.calls.at(-1)?.[1] as {
      type: string;
      data: { datasets: Array<{ backgroundColor: string[] }> };
      options: { cutout: string };
    };
    expect(chartConfig.type).toBe('doughnut');
    expect(chartConfig.data.datasets).toHaveLength(4);
    expect(chartConfig.data.datasets[0].backgroundColor[0]).toBe('#22c55e');
    expect(chartConfig.data.datasets[1].backgroundColor[0]).toBe('#eab308');
    expect(chartConfig.data.datasets[2].backgroundColor[0]).toBe('#ef4444');
    expect(chartConfig.data.datasets[3].backgroundColor[0]).toBe('#2563eb');
    expect(chartConfig.options.cutout).toBe('22%');
  });

  it('uses a default threshold when progressionThreshold is undefined', () => {
    fixture.componentRef.setInput('progression', progressionFixture({
      baptized_without_communion: { count: 1, eligible_count: 2 },
      baptized_without_confirmation: { count: 3, eligible_count: 4 },
    }));
    fixture.componentRef.setInput('progressionThreshold', undefined);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Baptized but no First Communion (age 10+)');
    expect(fixture.nativeElement.textContent).toContain('Baptized but not confirmation (age 10+)');
  });

  it('emits when a progression row is clicked', () => {
    const selected: string[] = [];
    fixture.componentRef.setInput('progression', progressionFixture({
      baptized_without_communion: { count: 2, eligible_count: 12 },
    }));
    component.progressionSelected.subscribe((key) => selected.push(key));
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button.progression-radial__legend-row') as NodeListOf<HTMLButtonElement>;
    expect(buttons.length).toBe(4);
    buttons[0].click();
    buttons[1].click();
    buttons[2].click();
    buttons[3].click();

    expect(selected).toEqual([
      'baptized_without_communion',
      'baptized_without_confirmation',
      'female_unmarried_over_18',
      'male_unmarried_over_23',
    ]);
  });
});
