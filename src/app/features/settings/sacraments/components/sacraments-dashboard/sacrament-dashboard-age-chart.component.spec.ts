jest.mock('chart.js/auto', () => ({
  Chart: jest.fn().mockImplementation(() => ({ destroy: jest.fn() })),
}));

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SacramentDashboardAgeChartComponent } from './sacrament-dashboard-age-chart.component';
import { SacramentDashboardAgeByType } from '../../models/sacrament-dashboard.model';

function buildRow(
  overrides: Partial<SacramentDashboardAgeByType> = {},
): SacramentDashboardAgeByType {
  return {
    code: 'BAPTISM',
    label: 'Baptism',
    sacrament_type_id: 1,
    with_age_data: 2,
    average_age: 8,
    min_age: 1,
    max_age: 12,
    buckets: [
      { key: '0_6', label: '0–6', count: 0 },
      { key: '7_9', label: '7–9', count: 4 },
      { key: '10_12', label: '10–12', count: 2 },
    ],
    ...overrides,
  };
}

describe('SacramentDashboardAgeChartComponent', () => {
  let component: SacramentDashboardAgeChartComponent;
  let fixture: ComponentFixture<SacramentDashboardAgeChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SacramentDashboardAgeChartComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SacramentDashboardAgeChartComponent);
    component = fixture.componentInstance;
  });

  it('shows empty state when all sacrament rows have zero counts', () => {
    component.rows = [
      buildRow({
        buckets: [
          { key: '0_6', label: '0–6', count: 0 },
          { key: '7_9', label: '7–9', count: 0 },
        ],
      }),
    ];
    fixture.detectChanges();

    expect(component.hasData).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('No age data');
  });

  it('builds an accessible summary for multiple sacrament rows', () => {
    component.rows = [
      buildRow(),
      buildRow({
        code: 'EUCHARIST',
        label: 'Eucharist',
        sacrament_type_id: 2,
        buckets: [
          { key: '0_6', label: '0–6', count: 0 },
          { key: '7_9', label: '7–9', count: 1 },
          { key: '10_12', label: '10–12', count: 0 },
        ],
      }),
    ];
    fixture.detectChanges();

    expect(component.hasData).toBe(true);
    expect(component.activeRows).toHaveLength(2);
    expect(component.dataSummary).toContain('Baptism');
    expect(component.dataSummary).toContain('Eucharist');
    expect(fixture.nativeElement.querySelector('canvas')?.getAttribute('aria-label')).toContain('Baptism');
    expect(fixture.nativeElement.textContent).toContain('Eucharist');
  });

  it('excludes reconciliation and anointing from age distribution rows', () => {
    component.rows = [
      buildRow(),
      buildRow({
        code: 'RECONCILIATION',
        label: 'Reconciliation',
        sacrament_type_id: 3,
        buckets: [{ key: '18_25', label: '18–25', count: 2 }],
      }),
      buildRow({
        code: 'ANOINTING',
        label: 'Anointing of the Sick',
        sacrament_type_id: 4,
        buckets: [{ key: '51_plus', label: '51+', count: 1 }],
      }),
    ];
    fixture.detectChanges();

    expect(component.activeRows).toHaveLength(1);
    expect(component.activeRows[0].code).toBe('BAPTISM');
    expect(fixture.nativeElement.textContent).not.toContain('Reconciliation');
    expect(fixture.nativeElement.textContent).not.toContain('Anointing of the Sick');
  });
});
