import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { FamilyDashboardPageComponent } from './family-dashboard.page';
import { FamilyService } from '@core/services/family.service';
import { BCCService } from '@core/services/bcc.service';
import { SubscriptionAccessService } from '@core/services/subscription-access.service';
import { FamilyDashboardSummary } from '../models/family-dashboard.model';

describe('FamilyDashboardPageComponent', () => {
  const routerStub = { navigate: jest.fn() };
  let dashboardData: FamilyDashboardSummary;
  const summary = {
    kpis: {
      total_families: 2,
      total_people: 5,
      active_families: 2,
      active_people: 5,
      new_families: 1,
      average_family_size: 2.5,
      active_families_percent: 100,
      active_people_percent: 100,
    },
    attention: {
      no_active_head: 0,
      no_contact: 0,
      no_address: 0,
      no_members: 0,
      missing_dob: 0,
      missing_gender: 0,
      missing_relationship: 0,
    },
    demographics: {
      age_groups: {},
      gender: {},
      with_dob: 0,
      without_dob: 0,
      with_gender: 0,
      without_gender: 0,
      under_18: 0,
      under_18_insight: null,
    },
    household: { bands: {}, average: 2.5, families_with_members: 2, families_without_members: 0, have_under_18: 0, have_seniors: 0, multiple_adults: 0, no_active_head: 0, head_gender: {} },
    growth: { families: [], members: [], recent_families: [], caption: 'Newly created records' },
    bcc: [],
    locations: [],
    background: {
      occupation: { recorded: 0, not_recorded: 5, total: 5, values: [] },
      education: { recorded: 0, not_recorded: 5, total: 5, values: [] },
    },
    data_quality: {
      family_profile: { complete_count: 2, incomplete_count: 0, percent: 100, definition: 'x' },
      members: { missing_dob: 0, missing_gender: 0, missing_relationship: 0, total: 5 },
    },
    population: {},
    filters: { bcc_id: null, status: null, period: '12m', from: '', to: '' },
    definitions: {},
    meta: { generated_at: new Date().toISOString(), cached: false },
  } as unknown as FamilyDashboardSummary;

  beforeEach(async () => {
    routerStub.navigate.mockReset();
    dashboardData = summary;
    await TestBed.configureTestingModule({
      imports: [FamilyDashboardPageComponent],
      providers: [
        { provide: FamilyService, useValue: { getDashboard: jest.fn(() => of({ success: true, data: dashboardData })) } },
        { provide: BCCService, useValue: { getBCCs: jest.fn(() => of({ data: [] })) } },
        { provide: Router, useValue: routerStub },
        { provide: SubscriptionAccessService, useValue: { isReadOnly: () => false } },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(convertToParamMap({})),
            snapshot: { queryParamMap: convertToParamMap({}) },
          },
        },
      ],
    }).compileComponents();
  });

  it('loads the dashboard summary', () => {
    const fixture = TestBed.createComponent(FamilyDashboardPageComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.summary()?.kpis.total_families).toBe(2);
  });

  it('sends manage families to the list with scope', () => {
    const fixture = TestBed.createComponent(FamilyDashboardPageComponent);
    fixture.componentInstance.bccId = 'bcc-1';
    fixture.componentInstance.manageFamilies();
    expect(routerStub.navigate).toHaveBeenCalledWith(['/families/list'], {
      queryParams: { bcc_id: 'bcc-1', status: undefined },
    });
  });

  it('carries family_status on member drill-down', () => {
    const fixture = TestBed.createComponent(FamilyDashboardPageComponent);
    fixture.componentInstance.status = 'active';
    fixture.componentInstance.memberList({ age_band: 'adults' });
    expect(routerStub.navigate).toHaveBeenCalledWith(['/members/list'], {
      queryParams: { age_band: 'adults', family_status: 'active' },
    });
  });

  it('opens the filter panel and applies BCC and status to the URL', () => {
    const fixture = TestBed.createComponent(FamilyDashboardPageComponent);
    const page = fixture.componentInstance;
    fixture.detectChanges();
    page.openAdvancedSearch();
    expect(page.showAdvancedSearch).toBe(true);
    page.onAdvancedSearch({ bcc_id: 'bcc-1', status: 'active', period: '12m' });
    expect(routerStub.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: {
          bcc_id: 'bcc-1',
          status: 'active',
          period: null,
          from: null,
          to: null,
        },
      })
    );
    expect(page.showAdvancedSearch).toBe(false);
  });

  it('aligns the four distribution charts in one panel with matching bar heights', () => {
    const fixture = TestBed.createComponent(FamilyDashboardPageComponent);
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector('.family-dash__charts') as HTMLElement;
    expect(panel).toBeTruthy();
    expect(panel.querySelectorAll('.family-dash__chart-cell').length).toBe(4);
    expect(
      Array.from(panel.querySelectorAll('.cf-section-title')).map((node) => node.textContent?.trim())
    ).toEqual(['Age distribution', 'Gender distribution', 'Family size', 'Household profile']);

    const age = fixture.debugElement.query(By.css('.family-dash__age-chart'));
    expect(age.componentInstance.compact).toBe(true);

    const charts = fixture.debugElement.queryAll(By.css('.family-dash__charts app-family-metric-chart'));
    expect(charts.map((chart) => chart.componentInstance.type)).toEqual(['bar', 'bar', 'bar']);
    expect(charts.map((chart) => chart.componentInstance.chartMinHeight)).toEqual([176, 176, 176]);
    expect(charts.every((chart) => chart.componentInstance.legendBeside)).toBe(true);
  });

  it('opens the filtered list for every chart legend item', () => {
    dashboardData = {
      ...summary,
      demographics: {
        ...summary.demographics,
        age_groups: {
          adults: { label: 'Adults', min: 26, max: 59, count: 3, percent: 100 },
        },
        gender: { male: { count: 2, percent: 100 } },
        under_18_insight: 'Includes children',
      },
      household: {
        ...summary.household,
        have_under_18: 1,
        no_active_head: 1,
      },
      background: {
        occupation: {
          recorded: 1,
          not_recorded: 0,
          total: 1,
          values: [{ key: 'professional', label: 'Professional', count: 1, percent: 100 }],
        },
        education: {
          recorded: 1,
          not_recorded: 0,
          total: 1,
          values: [{ key: 'Postgraduate (PG)', label: 'Postgraduate (PG)', count: 1, percent: 100 }],
        },
      },
    };
    const fixture = TestBed.createComponent(FamilyDashboardPageComponent);
    fixture.componentInstance.bccId = 'bcc-1';
    fixture.componentInstance.status = 'active';
    fixture.detectChanges();

    const clickLegend = (headingId: string, label: string) => {
      const section = fixture.nativeElement.querySelector(`[aria-labelledby="${headingId}"]`) as HTMLElement;
      const button = Array.from(section.querySelectorAll('button')).find((node) =>
        node.textContent?.includes(label)
      ) as HTMLButtonElement;
      expect(button).toBeTruthy();
      button.click();
    };

    clickLegend('age-heading', 'Adults');
    clickLegend('gender-heading', 'Male');
    clickLegend('size-heading', '1 member');
    clickLegend('household-heading', 'Have children or teenagers');
    clickLegend('household-heading', 'No active family head');

    const background = fixture.nativeElement.querySelector('[aria-label="Occupation and education"]') as HTMLElement;
    const occupationButton = Array.from(background.querySelectorAll('button')).find((node) =>
      node.textContent?.includes('Professional')
    ) as HTMLButtonElement;
    const educationButton = Array.from(background.querySelectorAll('button')).find((node) =>
      node.textContent?.includes('Postgraduate (PG)')
    ) as HTMLButtonElement;
    occupationButton.click();
    educationButton.click();

    expect(routerStub.navigate).toHaveBeenCalledWith(['/members/list'], {
      queryParams: { age_band: 'adults', bcc_id: 'bcc-1', family_status: 'active' },
    });
    expect(routerStub.navigate).toHaveBeenCalledWith(['/members/list'], {
      queryParams: { gender: 'male', bcc_id: 'bcc-1', family_status: 'active' },
    });
    expect(routerStub.navigate).toHaveBeenCalledWith(['/families/list'], {
      queryParams: { bcc_id: 'bcc-1', status: 'active', size_band: '1' },
    });
    expect(routerStub.navigate).toHaveBeenCalledWith(['/families/list'], {
      queryParams: { bcc_id: 'bcc-1', status: 'active', household: 'under_18' },
    });
    expect(routerStub.navigate).toHaveBeenCalledWith(['/families/list'], {
      queryParams: { bcc_id: 'bcc-1', status: 'active', missing: 'head' },
    });
    expect(routerStub.navigate).toHaveBeenCalledWith(['/members/list'], {
      queryParams: { occupation: 'Professional', bcc_id: 'bcc-1', family_status: 'active' },
    });
    expect(routerStub.navigate).toHaveBeenCalledWith(['/members/list'], {
      queryParams: { education: 'Postgraduate (PG)', bcc_id: 'bcc-1', family_status: 'active' },
    });
  });

  it('sends toolbar search to the family list', () => {
    const fixture = TestBed.createComponent(FamilyDashboardPageComponent);
    fixture.componentInstance.onListSearchChange('Joseph');
    expect(routerStub.navigate).toHaveBeenCalledWith(['/families/list'], {
      queryParams: { bcc_id: undefined, status: undefined, search: 'Joseph' },
    });
  });
});
