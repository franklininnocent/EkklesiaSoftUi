jest.mock('chart.js/auto', () => ({
  Chart: jest.fn().mockImplementation(() => ({ destroy: jest.fn() })),
}));

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SacramentDashboardTypeDonutChartComponent } from './sacrament-dashboard-type-donut-chart.component';

describe('SacramentDashboardTypeDonutChartComponent', () => {
  let component: SacramentDashboardTypeDonutChartComponent;
  let fixture: ComponentFixture<SacramentDashboardTypeDonutChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SacramentDashboardTypeDonutChartComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SacramentDashboardTypeDonutChartComponent);
    component = fixture.componentInstance;
  });

  it('shows empty state when all counts are zero', () => {
    component.rows = [
      { code: 'BAPTISM', label: 'Baptism', count: 0 },
      { code: 'EUCHARIST', label: 'First Communion', count: 0 },
    ];
    fixture.detectChanges();

    expect(component.hasData).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('No sacrament types');
  });

  it('builds an accessible summary for populated rows', () => {
    component.rows = [
      { code: 'BAPTISM', label: 'Baptism', count: 3 },
      { code: 'EUCHARIST', label: 'First Communion', count: 1 },
    ];
    component.typeKpis = [
      {
        sacrament_type_id: 1,
        code: 'BAPTISM',
        label: 'Baptism',
        period: 3,
        all_time: 10,
        yoy_pct: 0,
      },
    ];
    fixture.detectChanges();

    expect(component.hasData).toBe(true);
    expect(component.dataSummary).toContain('Baptism: 3');
    expect(fixture.nativeElement.querySelector('canvas')?.getAttribute('aria-label')).toContain('First Communion: 1');
  });
});
