jest.mock('chart.js/auto', () => ({
  Chart: jest.fn().mockImplementation(() => ({ destroy: jest.fn() }))
}));

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardCollectionChartComponent } from './dashboard-collection-chart.component';
import { DonationDashboardSummary } from '../models/donation.model';

describe('DashboardCollectionChartComponent', () => {
  let component: DashboardCollectionChartComponent;
  let fixture: ComponentFixture<DashboardCollectionChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardCollectionChartComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardCollectionChartComponent);
    component = fixture.componentInstance;
    component.summary = {
      totals: { collected: 0, refunded: 0, net: 0, pending_dues: 0, active_projects: 0 },
      collections_by_method: {},
      collection_performance_chart: {
        granularity: 'month',
        series: [
          {
            key: 'collected',
            label: 'Collected',
            points: Array.from({ length: 12 }, (_, index) => ({
              period: `2025-${String(index + 1).padStart(2, '0')}`,
              label: `M${index + 1}`,
              value: index * 100
            }))
          },
          { key: 'outstanding', label: 'Outstanding', points: [] },
          { key: 'target', label: 'Target', points: [] }
        ]
      }
    } as DonationDashboardSummary;
    fixture.detectChanges();
  });

  it('renders twelve monthly groups by default', () => {
    expect(component.groups.length).toBe(12);
  });

  it('aggregates to quarters when toggled', () => {
    component.setPeriod('quarter');
    expect(component.groups.length).toBe(4);
  });
});
