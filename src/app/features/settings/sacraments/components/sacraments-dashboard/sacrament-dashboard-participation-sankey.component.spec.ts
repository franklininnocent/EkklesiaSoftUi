jest.mock('chartjs-chart-sankey', () => ({
  SankeyController: class SankeyController {},
  Flow: class Flow {},
}));

jest.mock('chart.js', () => ({
  Chart: jest.fn().mockImplementation(() => ({ destroy: jest.fn() })),
  register: jest.fn(),
}));

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SacramentDashboardParticipationSankeyComponent } from './sacrament-dashboard-participation-sankey.component';

describe('SacramentDashboardParticipationSankeyComponent', () => {
  let component: SacramentDashboardParticipationSankeyComponent;
  let fixture: ComponentFixture<SacramentDashboardParticipationSankeyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SacramentDashboardParticipationSankeyComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SacramentDashboardParticipationSankeyComponent);
    component = fixture.componentInstance;
  });

  it('shows empty state when no eligible members', () => {
    component.rows = [
      {
        code: 'BAPTISM',
        label: 'Baptism',
        sacrament_type_id: 1,
        eligible_count: 0,
        received_count: 0,
        missing_count: 0,
        participation_pct: 0,
        missing_age_buckets: [],
      },
    ];
    fixture.detectChanges();

    expect(component.hasData).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('No participation data yet');
  });

  it('builds an accessible summary for participation flows', () => {
    component.rows = [
      {
        code: 'BAPTISM',
        label: 'Baptism',
        sacrament_type_id: 1,
        eligible_count: 10,
        received_count: 8,
        missing_count: 2,
        participation_pct: 80,
        missing_age_buckets: [],
      },
      {
        code: 'EUCHARIST',
        label: 'First Communion',
        sacrament_type_id: 2,
        eligible_count: 6,
        received_count: 4,
        missing_count: 2,
        participation_pct: 67,
        missing_age_buckets: [],
      },
    ];
    fixture.detectChanges();

    expect(component.hasData).toBe(true);
    expect(component.dataSummary).toContain('Baptism: 8 received, 2 missing');
    expect(fixture.nativeElement.querySelector('canvas')?.getAttribute('aria-label')).toContain('First Communion');
  });
});
