jest.mock('chart.js/auto', () => ({
  Chart: jest.fn().mockImplementation(() => ({ destroy: jest.fn() })),
}));

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SacramentDashboardMemberStatusChartComponent } from './sacrament-dashboard-member-status-chart.component';

describe('SacramentDashboardMemberStatusChartComponent', () => {
  let component: SacramentDashboardMemberStatusChartComponent;
  let fixture: ComponentFixture<SacramentDashboardMemberStatusChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SacramentDashboardMemberStatusChartComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SacramentDashboardMemberStatusChartComponent);
    component = fixture.componentInstance;
  });

  it('shows empty state when all counts are zero', () => {
    component.memberStatus = { member: 0, non_member: 0, unknown: 0 };
    fixture.detectChanges();

    expect(component.hasData).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('No records in this period');
  });

  it('builds an accessible summary when data exists', () => {
    component.memberStatus = { member: 1, non_member: 2, unknown: 0 };
    fixture.detectChanges();

    expect(component.hasData).toBe(true);
    expect(component.dataSummary).toContain('Parish families 1');
    expect(component.dataSummary).toContain('Visitors / others 2');
    expect(fixture.nativeElement.querySelector('canvas')?.getAttribute('aria-label')).toContain('Parish families 1');
  });
});
