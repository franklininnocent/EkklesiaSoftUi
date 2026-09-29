jest.mock('chart.js/auto', () => ({
  Chart: jest.fn().mockImplementation(() => ({ destroy: jest.fn() })),
}));

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SacramentDashboardGenderChartComponent } from './sacrament-dashboard-gender-chart.component';
import { SacramentDashboardGenderByType } from '../../models/sacrament-dashboard.model';

function buildRow(
  overrides: Partial<SacramentDashboardGenderByType> = {},
): SacramentDashboardGenderByType {
  return {
    code: 'BAPTISM',
    label: 'Baptism',
    sacrament_type_id: 1,
    male: 2,
    female: 3,
    other: 0,
    unknown: 1,
    ...overrides,
  };
}

describe('SacramentDashboardGenderChartComponent', () => {
  let component: SacramentDashboardGenderChartComponent;
  let fixture: ComponentFixture<SacramentDashboardGenderChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SacramentDashboardGenderChartComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SacramentDashboardGenderChartComponent);
    component = fixture.componentInstance;
  });

  it('shows empty state when all sacrament rows have zero counts', () => {
    component.rows = [
      buildRow({ male: 0, female: 0, other: 0, unknown: 0 }),
    ];
    fixture.detectChanges();

    expect(component.hasData).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('No gender data');
  });

  it('builds an accessible summary for multiple sacrament rows', () => {
    component.rows = [
      buildRow(),
      buildRow({
        code: 'EUCHARIST',
        label: 'Eucharist',
        sacrament_type_id: 2,
        male: 1,
        female: 0,
        other: 0,
        unknown: 0,
      }),
    ];
    fixture.detectChanges();

    expect(component.hasData).toBe(true);
    expect(component.activeRows).toHaveLength(2);
    expect(component.totalRecipients).toBe(7);
    expect(component.dataSummary).toContain('Baptism');
    expect(component.dataSummary).toContain('Eucharist');
    expect(component.dataSummary).toContain('Male: 2');
    expect(fixture.nativeElement.querySelector('canvas')?.getAttribute('aria-label')).toContain('Baptism');
    expect(fixture.nativeElement.textContent).toContain('Male');
    expect(fixture.nativeElement.textContent).toContain('Female');
  });
});
