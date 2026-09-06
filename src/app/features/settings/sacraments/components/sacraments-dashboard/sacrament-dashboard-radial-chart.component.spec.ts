jest.mock('chart.js/auto', () => ({
  Chart: jest.fn().mockImplementation(() => ({ destroy: jest.fn() })),
}));

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Chart } from 'chart.js/auto';
import { SacramentDashboardRadialChartComponent } from './sacrament-dashboard-radial-chart.component';

describe('SacramentDashboardRadialChartComponent', () => {
  let component: SacramentDashboardRadialChartComponent;
  let fixture: ComponentFixture<SacramentDashboardRadialChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SacramentDashboardRadialChartComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SacramentDashboardRadialChartComponent);
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

  it('renders category zeros instead of an empty-state message', () => {
    component.items = [
      { key: '18_25', label: '18–25', count: 0 },
      { key: '26_30', label: '26–30', count: 0 },
    ];
    component.emptyMessage = 'No age data yet.';
    fixture.detectChanges();

    expect(component.hasItems).toBe(true);
    expect(component.hasPositiveData).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('18–25');
    expect(fixture.nativeElement.textContent).toContain('0');
    expect(fixture.nativeElement.textContent).not.toContain('No age data yet.');
    expect(fixture.nativeElement.querySelector('canvas')).toBeNull();
  });

  it('builds an accessible summary and doughnut of actual counts', () => {
    component.items = [
      { key: '18_25', label: '18–25', count: 2 },
      { key: '26_30', label: '26–30', count: 1 },
    ];
    component.centerValue = '27';
    component.centerLabel = 'Avg age';
    fixture.detectChanges();

    expect(component.hasData).toBe(true);
    expect(component.dataSummary).toContain('18–25: 2');
    expect(fixture.nativeElement.querySelector('canvas')?.getAttribute('aria-label')).toContain('26–30: 1');
    expect(fixture.nativeElement.textContent).toContain('Avg age');
    expect((Chart as unknown as jest.Mock).mock.calls.length).toBeGreaterThan(0);

    const chartConfig = (Chart as unknown as jest.Mock).mock.calls.at(-1)?.[1] as {
      type: string;
      data: { labels: string[]; datasets: Array<{ data: number[] }> };
    };
    expect(chartConfig.type).toBe('doughnut');
    expect(chartConfig.data.labels).toEqual(['18–25', '26–30']);
    expect(chartConfig.data.datasets[0].data).toEqual([2, 1]);
  });

  it('shows the empty message only when there are no categories', () => {
    component.items = [];
    component.emptyMessage = 'No parish of origin recorded yet.';
    fixture.detectChanges();

    expect(component.hasItems).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('No parish of origin recorded yet.');
  });
});
