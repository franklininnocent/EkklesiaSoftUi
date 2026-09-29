jest.mock('chart.js/auto', () => ({
  Chart: jest.fn().mockImplementation(() => ({ destroy: jest.fn() })),
}));

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Chart } from 'chart.js/auto';
import { SacramentDashboardMetricRadialChartComponent } from './sacrament-dashboard-metric-radial-chart.component';

describe('SacramentDashboardMetricRadialChartComponent', () => {
  let fixture: ComponentFixture<SacramentDashboardMetricRadialChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SacramentDashboardMetricRadialChartComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SacramentDashboardMetricRadialChartComponent);
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

  it('renders center total and legend percentages', () => {
    fixture.componentRef.setInput('centerValue', 10);
    fixture.componentRef.setInput('centerLabel', 'active applications');
    fixture.componentRef.setInput('rings', [
      { key: 'banns', label: 'Banns published', count: 5, pct: 50 },
      { key: 'inquiry', label: 'Inquiry started', count: 10, pct: 100 },
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('10');
    expect(fixture.nativeElement.textContent).toContain('active applications');
    expect(fixture.nativeElement.textContent).toContain('Banns published');
    expect(fixture.nativeElement.textContent).toContain('5 (50%)');
    expect((Chart as unknown as jest.Mock).mock.calls.length).toBeGreaterThan(0);
  });

  it('shows empty state when no rings are provided', () => {
    fixture.componentRef.setInput('centerValue', 0);
    fixture.componentRef.setInput('rings', []);
    fixture.componentRef.setInput('emptyMessage', 'No active marriage applications');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No active marriage applications');
    expect(fixture.nativeElement.querySelector('canvas')).toBeNull();
  });

  it('renders radial rings even when center total is zero', () => {
    fixture.componentRef.setInput('centerValue', 0);
    fixture.componentRef.setInput('centerLabel', 'active applications');
    fixture.componentRef.setInput('rings', [
      { key: 'inquiry', label: 'Inquiry started', count: 0, pct: 0 },
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('0');
    expect(fixture.nativeElement.textContent).toContain('active applications');
    expect(fixture.nativeElement.querySelector('canvas')).not.toBeNull();
  });
});
