import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, EMPTY } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ChurchCurrencyService } from '@core/services/church-currency.service';
import { DonationsProjectInstallmentsComponent } from './donations-project-installments.component';
import { DonationsService } from '../services/donations.service';
import { QuickCollectService } from '../services/quick-collect.service';
import { BCCService } from '@core/services/bcc.service';
import { FamilyService } from '@core/services/family.service';

describe('DonationsProjectInstallmentsComponent', () => {
  let fixture: ComponentFixture<DonationsProjectInstallmentsComponent>;
  let component: DonationsProjectInstallmentsComponent;
  let getProjectInstallments: jest.Mock;

  beforeEach(async () => {
    getProjectInstallments = jest.fn().mockReturnValue(
      of({
        success: true,
        data: { data: [], current_page: 1, last_page: 1, total: 0, per_page: 20 },
      })
    );

    await TestBed.configureTestingModule({
      imports: [DonationsProjectInstallmentsComponent],
      providers: [
        provideRouter([]),
        {
          provide: DonationsService,
          useValue: {
            getProjects: jest.fn().mockReturnValue(of({ success: true, data: [{ id: 'p1', name: 'Roof Fund' }] })),
            getProjectInstallments,
            waiveProjectInstallment: jest.fn(),
            cancelProjectInstallment: jest.fn(),
            ledgerMutated$: EMPTY,
          },
        },
        { provide: QuickCollectService, useValue: { open: jest.fn(), openForFamily: jest.fn() } },
        { provide: AuthService, useValue: { hasPermission: jest.fn(() => true) } },
        { provide: ChurchCurrencyService, useValue: { currencyCode: () => 'USD' } },
        { provide: BCCService, useValue: { getBCCs: jest.fn().mockReturnValue(of({ data: [] })) } },
        { provide: FamilyService, useValue: { getFamilies: jest.fn().mockReturnValue(of({ data: [] })) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DonationsProjectInstallmentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('uses filter drawer instead of inline filter row', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-advanced-search-panel')).toBeTruthy();
    expect(el.querySelector('button[aria-label="Filters"]')).toBeTruthy();
    expect(el.querySelector('.filters.cf-filters')).toBeNull();
    expect(el.querySelector('.cf-page-header__actions input[type="search"]')).toBeNull();
    expect(el.querySelector('.cf-decision-strip')).toBeNull();
    expect(el.textContent).not.toContain('Prioritize overdue installments');
    expect(el.textContent).not.toContain('Installment register');
    expect(el.querySelector('.stewardship-panel-head')).toBeNull();
  });

  it('loads installments with default API filters, pagination, and sort', () => {
    expect(getProjectInstallments).toHaveBeenCalledWith({
      page: '1',
      per_page: '20',
      sort: 'outstanding',
      direction: 'desc',
    });
  });

  it('sends sort params when a column header is sorted', () => {
    getProjectInstallments.mockClear();
    component.onSort({ column: 'family_name', direction: 'desc' });
    expect(getProjectInstallments).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: 'family_name', direction: 'desc' })
    );
  });

  it('applies panel filters to the API and shows chips', () => {
    component.onAdvancedSearch({
      search: 'Smith',
      project_id: 'p1',
      overdue_only: true,
      status: 'pending',
    });
    fixture.detectChanges();

    expect(getProjectInstallments).toHaveBeenLastCalledWith({
      page: '1',
      per_page: '20',
      search: 'Smith',
      project_id: 'p1',
      overdue_only: true,
      status: 'pending',
      sort: 'outstanding',
      direction: 'desc',
    });
    expect(component.activeFilterChips.length).toBe(4);
    expect(fixture.nativeElement.querySelector('app-stewardship-active-filter-chips')).toBeTruthy();
  });

  it('renders family head name in the family column, not household family_name', () => {
    component.installments = [
      {
        id: 'due-1',
        project_id: 'p1',
        family_id: 'f1',
        installment_number: 1,
        installment_label: 'Q1',
        due_date: '2026-09-01',
        amount_due: 500,
        amount_paid: 0,
        status: 'pending',
        family_head_name: 'John Peter',
        family: { id: 'f1', family_name: 'Ward Household', family_code: 'FAM001' },
        project: { id: 'p1', name: 'Roof Fund', code: 'ROOF' },
      },
    ];
    component.loading = false;
    fixture.detectChanges();

    const link = (fixture.nativeElement as HTMLElement).querySelector('tbody td a.cf-link');
    expect(link?.textContent?.trim()).toBe('John Peter');
  });

  it('clears filters and reloads', () => {
    component.projectFilter = 'p1';
    component.overdueOnly = true;
    component.onClearAdvancedSearch();
    fixture.detectChanges();

    expect(component.projectFilter).toBe('');
    expect(component.overdueOnly).toBe(false);
    expect(getProjectInstallments).toHaveBeenLastCalledWith({
      page: '1',
      per_page: '20',
      sort: 'outstanding',
      direction: 'desc',
    });
  });

  it('requests another page when pagination changes', () => {
    getProjectInstallments.mockClear();
    component.goToPage(3);
    expect(getProjectInstallments).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: '3', per_page: '20' })
    );
  });
});
