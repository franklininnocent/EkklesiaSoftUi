import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { BCCService } from '@core/services/bcc.service';
import { BccDashboardPageComponent } from './bcc-dashboard.page';

class BCCServiceMock {
  getDashboard = jest.fn(() =>
    of({
      success: true,
      data: {
        bccs: { total: 2, active: 2, inactive: 0, suspended: 0 },
        families: { in_bcc: 4, without_bcc: 1 },
        members: { total: 12, active: 10 },
        leadership: {
          active_leaders: 1,
          bccs_without_primary: 1,
          bccs_with_primary: 1,
          coverage_percent: 50,
        },
        top_bccs: [{ id: '1', name: 'St Joseph', bcc_code: 'BCC0001', status: 'active', family_count: 4 }],
        bccs_without_primary_leader: [],
        recent_activity: [],
        generated_at: new Date().toISOString(),
        definitions: {
          coverage: 'Percentage of parish families with a BCC assignment.',
          people: 'Family members in families currently assigned to a BCC.',
          life_stage: 'Age bands',
          leadership_coverage: 'Share of active BCCs with a primary leader.',
          data_quality: 'Completeness',
        },
        snapshot: {
          bccs_total: 2,
          bccs_active: 2,
          bccs_inactive: 0,
          bccs_suspended: 0,
          families_connected: 4,
          people_connected: 12,
          active_members: 10,
          parish_families: 5,
          families_without_bcc: 1,
          coverage_percent: 80,
          coverage_percent_point_change: 2.5,
          average_bcc_size: 6,
          leadership_coverage_percent: 50,
          active_leaders: 1,
          bccs_without_primary: 1,
          bccs_with_primary: 1,
          empty_bccs: 0,
        },
        coverage: {
          linked: 4,
          unlinked: 1,
          total: 5,
          percent: 80,
          percent_point_change: 2.5,
        },
        growth: {
          period: 'x',
          insufficient_history: false,
          families: [
            { period: '2026-01', label: 'Jan 2026', value: 2 },
            { period: '2026-02', label: 'Feb 2026', value: 4 },
          ],
          people: [
            { period: '2026-01', label: 'Jan 2026', value: 6 },
            { period: '2026-02', label: 'Feb 2026', value: 12 },
          ],
        },
        community_changes: { growing: [], declining: [] },
        insights: [{ id: 'unlinked', severity: 'attention', text: '1 families currently have no BCC assignment.' }],
        attention: [
          { type: 'unlinked_families', severity: 'attention', count: 1, label: 'Families without a BCC' },
        ],
        community_overview: {
          rows: [
            {
              id: '1',
              name: 'St Joseph',
              bcc_code: 'BCC0001',
              families: 4,
              people: 12,
              trend_pct: 8.2,
              trend_delta: 1,
              primary_leader_name: 'John',
              status: 'active',
              attention_flags: [],
            },
          ],
          limit: 10,
          total_matching: 2,
          label: 'Top 10 by families',
        },
        size_distribution: [{ bucket: '11-25', label: '11-25 people', count: 2 }],
        demographics: {
          total: 12,
          gender: {
            male: { count: 5, percent: 41.7 },
            female: { count: 7, percent: 58.3 },
            other: { count: 0, percent: 0 },
            unknown: { count: 0, percent: 0 },
          },
          age_groups: {
            babies: { label: 'Babies', min: 0, max: 2, count: 1, percent: 8 },
            children: { label: 'Children', min: 3, max: 12, count: 2, percent: 16 },
            teenagers: { label: 'Teenagers', min: 13, max: 17, count: 1, percent: 8 },
            young_adults: { label: 'Young adults', min: 18, max: 25, count: 1, percent: 8 },
            adults: { label: 'Adults', min: 26, max: 59, count: 6, percent: 50 },
            seniors: { label: 'Seniors', min: 60, max: null, count: 1, percent: 8 },
            unknown: { label: 'Unknown', min: null, max: null, count: 0, percent: 0 },
          },
        },
        data_quality: {
          completeness_percent: 94.2,
          review_total: 2,
          issues: {
            missing_address: 1,
            missing_phone: 0,
            missing_primary_leader: 1,
            unassigned_families: 1,
          },
        },
        coordinators: [],
      },
    })
  );
}

class AuthServiceMock {
  hasPermission = jest.fn(() => true);
  canAccessBcc = jest.fn(() => true);
}

describe('BccDashboardPageComponent', () => {
  let component: BccDashboardPageComponent;
  let fixture: ComponentFixture<BccDashboardPageComponent>;
  let api: BCCServiceMock;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BccDashboardPageComponent],
      providers: [
        provideRouter([]),
        { provide: BCCService, useClass: BCCServiceMock },
        { provide: AuthService, useClass: AuthServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BccDashboardPageComponent);
    component = fixture.componentInstance;
    api = TestBed.inject(BCCService) as unknown as BCCServiceMock;
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate');
    fixture.detectChanges();
  });

  it('loads parish dashboard summary', () => {
    expect(api.getDashboard).toHaveBeenCalled();
    expect(component.summary?.bccs.total).toBe(2);
    expect(component.summary?.coverage?.percent).toBe(80);
    expect(component.loading).toBe(false);
  });

  it('opens the BCC list from the dashboard', () => {
    component.openList();
    expect(router.navigate).toHaveBeenCalledWith(['/bccs/list']);
  });
});
