jest.mock('chart.js/auto', () => ({
  Chart: jest.fn().mockImplementation(() => ({ destroy: jest.fn() })),
}));

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SacramentDashboardMarriageCanonicalRadialChartComponent } from './sacrament-dashboard-marriage-canonical-radial-chart.component';

describe('SacramentDashboardMarriageCanonicalRadialChartComponent', () => {
  let fixture: ComponentFixture<SacramentDashboardMarriageCanonicalRadialChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SacramentDashboardMarriageCanonicalRadialChartComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SacramentDashboardMarriageCanonicalRadialChartComponent);
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

  it('maps canonical breakdown metrics for the register chart', () => {
    fixture.componentRef.setInput('breakdown', {
      total_recorded: 2,
      metrics: {
        catholic_both: { count: 1, pct: 50 },
        mixed_disparity: { count: 1, pct: 50 },
        same_parish: { count: 1, pct: 50 },
        inter_parish: { count: 1, pct: 50 },
      },
    });
    fixture.detectChanges();

    const legend = fixture.nativeElement.textContent as string;
    expect(legend).toContain('Sacramental marriages (both Catholic)');
    expect(legend).toContain('Both from same parish (bride & groom)');
    expect(legend).toContain('recorded marriages');
    expect(legend).toContain('1 (50%)');
  });

  it('emits ringSelected when a legend row is clicked', () => {
    const selected: string[] = [];
    fixture.componentInstance.ringSelected.subscribe((key) => selected.push(key));
    fixture.componentRef.setInput('breakdown', {
      total_recorded: 1,
      metrics: {
        catholic_both: { count: 1, pct: 100 },
        mixed_disparity: { count: 0, pct: 0 },
        same_parish: { count: 0, pct: 0 },
        inter_parish: { count: 0, pct: 0 },
      },
    });
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button.metric-radial__legend-row') as HTMLButtonElement;
    button.click();

    expect(selected).toEqual(['catholic_both']);
  });
});
