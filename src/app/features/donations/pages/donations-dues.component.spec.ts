import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, EMPTY } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ChurchCurrencyService } from '@core/services/church-currency.service';
import { EntitlementService } from '@core/services/entitlement.service';
import { DonationsDuesComponent } from './donations-dues.component';
import { DonationsService } from '../services/donations.service';
import { QuickCollectService } from '../services/quick-collect.service';

describe('DonationsDuesComponent', () => {
  let fixture: ComponentFixture<DonationsDuesComponent>;
  let component: DonationsDuesComponent;
  let getDues: jest.Mock;
  let router: Router;
  let quickCollect: { open: jest.Mock; openForFamily: jest.Mock };

  const duesResponse = {
    success: true,
    data: { data: [], total: 0, current_page: 1, last_page: 1, per_page: 20 },
    meta: { overdue_family_count: 0 },
  };

  beforeEach(async () => {
    getDues = jest.fn().mockReturnValue(of(duesResponse));
    quickCollect = { open: jest.fn(), openForFamily: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [DonationsDuesComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap({ due_schedule: 'next_14_days' }) },
            queryParamMap: of(convertToParamMap({ due_schedule: 'next_14_days' })),
          },
        },
        {
          provide: DonationsService,
          useValue: {
            getDues,
            getDashboardSummary: jest.fn().mockReturnValue(
              of({
                success: true,
                data: {
                  snapshot: {
                    outstanding_contributions: 1000,
                    overdue_amount: 200,
                    overdue_families: 2,
                  },
                },
              })
            ),
            queueWhatsAppOutreach: jest.fn(),
            generateScheduledContributions: jest.fn(),
            waiveDue: jest.fn(),
            cancelDue: jest.fn(),
            remindDue: jest.fn(),
            ledgerMutated$: EMPTY,
          },
        },
        { provide: QuickCollectService, useValue: quickCollect },
        { provide: AuthService, useValue: { hasPermission: jest.fn(() => true) } },
        { provide: ChurchCurrencyService, useValue: { currencyCode: () => 'USD' } },
        {
          provide: EntitlementService,
          useValue: {
            entitlements: signal(null),
            load: () => of(null),
            hasAllFeatures: () => true,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DonationsDuesComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('uses dashboard-style header actions and the shared filter drawer', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-advanced-search-panel')).toBeTruthy();
    expect(el.querySelector('button[aria-label="Filters"]')).toBeTruthy();
    expect(el.querySelector('button[aria-label="Collect Payment"]')).toBeTruthy();
    expect(el.querySelector('.cf-kpi-strip')).toBeTruthy();
    expect(el.querySelector('.dues-schedule-nav')).toBeNull();
    expect(el.querySelector('.dues-filters')).toBeNull();
    expect(el.querySelectorAll('.cf-page-header__actions .cf-btn-icon').length).toBeGreaterThanOrEqual(2);
  });

  it('loads dues from the due_schedule query param and shows an active filter chip', () => {
    expect(getDues).toHaveBeenCalledWith(
      expect.objectContaining({
        due_schedule: 'next_14_days',
        page: '1',
        per_page: '20',
        sort: 'due_date',
        direction: 'asc',
      })
    );
    expect(component.activeFilterCount).toBe(1);
    expect(component.activeFilterChips.map((chip) => chip.label)).toEqual(['Due schedule: Next 14 days']);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Due schedule: Next 14 days');
  });

  it('opens the standard side panel from the toolbar filter icon', () => {
    const filterButton = (fixture.nativeElement as HTMLElement).querySelector(
      'button[aria-label="Filters"]'
    ) as HTMLButtonElement;
    filterButton.click();
    fixture.detectChanges();
    expect(component.showFilters).toBe(true);
    expect(component.searchFields.map((field) => field.key)).toEqual([
      'search',
      'due_schedule',
      'overdue_only',
      'status',
    ]);
  });

  it('applies drawer filters through the dues query params', () => {
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    component.onAdvancedSearch({
      search: 'Varghese',
      due_schedule: 'overdue',
      status: 'pending',
      overdue_only: true,
    });
    expect(component.tableSearch).toBe('Varghese');
    expect(component.showFilters).toBe(false);
    expect(navigateSpy).toHaveBeenCalledWith(
      ['/donations/dues'],
      expect.objectContaining({
        queryParams: {
          due_schedule: 'overdue',
          overdue_only: null,
          status: 'pending',
          page: null,
        },
        queryParamsHandling: 'merge',
      })
    );
  });

  it('clears drawer filters from the shared panel reset action', () => {
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    component.tableSearch = 'Varghese';
    component.onClearAdvancedSearch();
    expect(component.tableSearch).toBe('');
    expect(component.showFilters).toBe(false);
    expect(navigateSpy).toHaveBeenCalledWith(
      ['/donations/dues'],
      expect.objectContaining({
        queryParams: {
          due_schedule: null,
          overdue_only: null,
          status: null,
          page: null,
        },
        queryParamsHandling: 'merge',
      })
    );
  });

  it('sends sort params when a column header is sorted', () => {
    getDues.mockClear();
    component.onSort({ column: 'family_name', direction: 'desc' });
    expect(component.sortColumn).toBe('family_name');
    expect(component.sortDirection).toBe('desc');
    expect(getDues).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'family_name', direction: 'desc' })
    );
  });

  it('opens Collect Payment with the due and family from the selected row', () => {
    component.collectForDue({
      id: 'due-1',
      family_id: 'fam-1',
      amount_due: 250,
      amount_paid: 0,
    } as any);
    expect(quickCollect.open).toHaveBeenCalledWith({
      familyId: 'fam-1',
      dueId: 'due-1',
    });
  });
});
