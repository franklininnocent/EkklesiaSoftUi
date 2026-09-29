jest.mock('chart.js/auto', () => ({
  Chart: jest.fn().mockImplementation(() => ({ destroy: jest.fn() })),
}));

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Chart } from 'chart.js/auto';
import {
  MATRIMONY_AGE_RADIAL_COLORS,
  SacramentDashboardMatrimonyAgeRadialChartComponent,
} from './sacrament-dashboard-matrimony-age-radial-chart.component';

describe('SacramentDashboardMatrimonyAgeRadialChartComponent', () => {
  let component: SacramentDashboardMatrimonyAgeRadialChartComponent;
  let fixture: ComponentFixture<SacramentDashboardMatrimonyAgeRadialChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SacramentDashboardMatrimonyAgeRadialChartComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SacramentDashboardMatrimonyAgeRadialChartComponent);
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

  it('renders bride and groom radial bar charts with traffic-light colors', () => {
    fixture.componentRef.setInput('brideBuckets', [
      { key: '18_25', label: '18–25', count: 2 },
      { key: '26_30', label: '26–30', count: 1 },
    ]);
    fixture.componentRef.setInput('groomBuckets', [
      { key: '18_25', label: '18–25', count: 1 },
      { key: '26_30', label: '26–30', count: 2 },
    ]);
    fixture.detectChanges();

    expect(component.hasData).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Bride');
    expect(fixture.nativeElement.textContent).toContain('Groom');
    expect(fixture.nativeElement.querySelectorAll('canvas').length).toBe(2);
    expect((Chart as unknown as jest.Mock).mock.calls.length).toBeGreaterThan(0);

    const chartConfig = (Chart as unknown as jest.Mock).mock.calls.at(-1)?.[1] as {
      type: string;
      data: { datasets: Array<{ backgroundColor: string[] }> };
    };
    expect(chartConfig.type).toBe('doughnut');
    expect(chartConfig.data.datasets[0].backgroundColor[0]).toBe(MATRIMONY_AGE_RADIAL_COLORS[0]);
  });

  it('builds an accessible summary for screen readers', () => {
    fixture.componentRef.setInput('brideBuckets', [{ key: '18_25', label: '18–25', count: 1 }]);
    fixture.componentRef.setInput('groomBuckets', [{ key: '26_30', label: '26–30', count: 1 }]);
    fixture.detectChanges();

    expect(component.dataSummary).toContain('Bride 18–25: 1');
    expect(component.dataSummary).toContain('Groom 26–30: 1');
  });
});
