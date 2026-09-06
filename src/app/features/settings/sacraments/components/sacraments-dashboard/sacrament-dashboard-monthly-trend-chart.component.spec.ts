jest.mock('chart.js/auto', () => ({
  Chart: jest.fn().mockImplementation(() => ({ destroy: jest.fn() })),
}));

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SacramentDashboardMonthlyTrendChartComponent } from './sacrament-dashboard-monthly-trend-chart.component';

describe('SacramentDashboardMonthlyTrendChartComponent', () => {
  let component: SacramentDashboardMonthlyTrendChartComponent;
  let fixture: ComponentFixture<SacramentDashboardMonthlyTrendChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SacramentDashboardMonthlyTrendChartComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SacramentDashboardMonthlyTrendChartComponent);
    component = fixture.componentInstance;
  });

  it('shows empty state when all monthly counts are zero', () => {
    component.series = [
      {
        code: 'BAPTISM',
        label: 'Baptism',
        points: [{ period: '2025-06', label: 'Jun', count: 0 }],
      },
    ];
    fixture.detectChanges();

    expect(component.hasData).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('No sacrament activity');
  });

  it('does not render a sacrament filter dropdown', () => {
    component.series = [
      {
        code: 'BAPTISM',
        label: 'Baptism',
        points: [{ period: '2025-06', label: 'Jun', count: 2 }],
      },
      {
        code: 'EUCHARIST',
        label: 'First Communion',
        points: [{ period: '2025-06', label: 'Jun', count: 3 }],
      },
    ];
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('select')).toBeNull();
  });

  it('sums all sacrament series for the 12-month total', () => {
    component.series = [
      {
        code: 'BAPTISM',
        label: 'Baptism',
        points: [{ period: '2025-06', label: 'Jun', count: 2 }],
      },
      {
        code: 'EUCHARIST',
        label: 'First Communion',
        points: [{ period: '2025-06', label: 'Jun', count: 3 }],
      },
    ];
    fixture.detectChanges();

    expect(component.hasData).toBe(true);
    expect(component.periodTotal).toBe(5);
    expect(component.dataSummary).toContain('All sacrament types');
    expect(component.dataSummary).toContain('Total 5');
  });

  it('renders a legend item per sacrament series', () => {
    component.series = [
      {
        code: 'BAPTISM',
        label: 'Baptism',
        points: [{ period: '2025-06', label: 'Jun', count: 2 }],
      },
      {
        code: 'EUCHARIST',
        label: 'First Communion',
        points: [{ period: '2025-06', label: 'Jun', count: 3 }],
      },
    ];
    fixture.detectChanges();

    const legendItems = fixture.nativeElement.querySelectorAll('.sacrament-monthly-trend__legend li');
    expect(legendItems.length).toBe(2);
    expect(legendItems[0].textContent).toContain('Baptism');
    expect(legendItems[1].textContent).toContain('First Communion');
  });

  it('emits selected point with the series code', () => {
    const emitSpy = jest.spyOn(component.pointSelected, 'emit');
    component.series = [
      {
        code: 'BAPTISM',
        label: 'Baptism',
        points: [{ period: '2025-06', label: 'Jun', count: 2 }],
      },
    ];
    fixture.detectChanges();

    component.pointSelected.emit({
      point: { period: '2025-06', label: 'Jun', count: 2 },
      seriesCode: 'BAPTISM',
    });

    expect(emitSpy).toHaveBeenCalledWith({
      point: { period: '2025-06', label: 'Jun', count: 2 },
      seriesCode: 'BAPTISM',
    });
  });

  it('excludes reconciliation and anointing from monthly trend series', () => {
    component.series = [
      {
        code: 'BAPTISM',
        label: 'Baptism',
        points: [{ period: '2025-06', label: 'Jun', count: 2 }],
      },
      {
        code: 'RECONCILIATION',
        label: 'Reconciliation',
        points: [{ period: '2025-06', label: 'Jun', count: 5 }],
      },
      {
        code: 'ANOINTING',
        label: 'Anointing of the Sick',
        points: [{ period: '2025-06', label: 'Jun', count: 1 }],
      },
    ];
    fixture.detectChanges();

    expect(component.visibleSeries).toHaveLength(1);
    expect(component.periodTotal).toBe(2);
    expect(fixture.nativeElement.textContent).not.toContain('Reconciliation');
    expect(fixture.nativeElement.textContent).not.toContain('Anointing of the Sick');
  });
});
