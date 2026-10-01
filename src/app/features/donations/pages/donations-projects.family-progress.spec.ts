import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError, EMPTY } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ChurchCurrencyService } from '@core/services/church-currency.service';
import { ToastService } from '@core/services/toast.service';
import { FamilyService } from '@core/services/family.service';
import { DonationsProjectsComponent } from './donations-projects.component';
import { DonationsService } from '../services/donations.service';
import {
  DonationProject,
  ProjectDashboard,
  ProjectFamilyProgressResponse,
  ProjectFamilyProgressRow
} from '../models/donation.model';
import { QuickCollectService } from '../services/quick-collect.service';

describe('DonationsProjectsComponent project detail family table', () => {
  let fixture: ComponentFixture<DonationsProjectsComponent>;
  let getProjectDashboard: jest.Mock;
  let getProjectFamilyProgress: jest.Mock;
  let quickCollect: { open: jest.Mock };

  const project: DonationProject = {
    id: 'proj-1',
    name: 'Parish Hall',
    code: 'HALL-2026',
    assignment_mode: 'uniform',
    target_amount: 1000,
    default_family_target: 100,
    raised_amount: 0,
    status: 'active',
  };

  beforeEach(async () => {
    getProjectDashboard = jest.fn().mockReturnValue(of({ success: true, data: dashboardFor(project, 30) }));
    getProjectFamilyProgress = jest.fn().mockReturnValue(of(familyProgressResponse([familyRow()])));
    quickCollect = { open: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [DonationsProjectsComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { hasPermission: () => true } },
        { provide: QuickCollectService, useValue: quickCollect },
        {
          provide: DonationsService,
          useValue: {
            getProjects: jest.fn().mockReturnValue(of({ success: true, data: [] })),
            getProjectDashboard,
            getProjectFamilyProgress,
            generateProjectInstallments: jest.fn(),
            ledgerMutated$: EMPTY,
          },
        },
        { provide: FamilyService, useValue: { getFamilies: jest.fn().mockReturnValue(of({ data: [] })) } },
        { provide: ChurchCurrencyService, useValue: { currencySymbol: () => '$', currencyCode: () => 'USD' } },
        { provide: ToastService, useValue: { success: jest.fn(), warning: jest.fn(), error: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DonationsProjectsComponent);
    fixture.detectChanges();
  });

  function openProject(rows: ProjectFamilyProgressRow[] = [familyRow()], total = rows.length): void {
    const bccs = [
      { id: 'unassigned', name: 'Unassigned Area' },
      { id: 'bcc-1', name: 'St Mary BCC' },
    ];
    getProjectFamilyProgress.mockImplementation((_id: string, query: { page: number; per_page: number }) => {
      const response = familyProgressResponse(rows, total, bccs);
      response.data.current_page = query.page;
      response.data.per_page = query.per_page;
      return of(response);
    });
    fixture.componentInstance.projects = [project];
    fixture.componentInstance.viewDashboard(project);
    fixture.detectChanges();
  }

  function lastQuery(): Record<string, unknown> {
    const calls = getProjectFamilyProgress.mock.calls;
    return calls[calls.length - 1][1];
  }

  it('does not request family rows until a project is opened', () => {
    expect(getProjectFamilyProgress).not.toHaveBeenCalled();
  });

  it('loads the first page from the server sorted by outstanding amount', () => {
    openProject();

    expect(getProjectFamilyProgress).toHaveBeenCalledWith('proj-1', {
      search: undefined,
      status: undefined,
      bcc_id: undefined,
      sort: 'outstanding_amount',
      direction: 'desc',
      page: 1,
      per_page: 20,
    });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[aria-label="Search families"]')).toBeTruthy();
    expect(el.querySelector('[aria-label="Filter by payment progress"]')).toBeTruthy();
    expect(el.querySelector('[aria-label="Filter by BCC or community"]')).toBeTruthy();
    expect(el.querySelector('app-pagination')).toBeTruthy();
    expect(el.querySelector('th[aria-sort="descending"]')?.textContent).toContain('Outstanding');
    expect(el.querySelector('.project-detail-modal__family')?.textContent?.trim()).toBe('John Peter - FAM001');
  });

  it('hides the community filter when enrolled families share one community', () => {
    getProjectFamilyProgress.mockReturnValue(of(familyProgressResponse([familyRow()], 1, [{ id: 'bcc-1', name: 'St Mary BCC' }])));
    fixture.componentInstance.projects = [project];
    fixture.componentInstance.viewDashboard(project);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('[aria-label="Filter by BCC or community"]')).toBeFalsy();
  });

  it('debounces search and resets to the first page', fakeAsync(() => {
    openProject([familyRow()], 45);
    const component = fixture.componentInstance;
    component.onFamilyPageChange(3);
    expect(lastQuery()['page']).toBe(3);
    expect(component.familyPage).toBe(3);

    component.onFamilySearchChange('  john ');
    tick(299);
    expect(lastQuery()['search']).toBeUndefined();
    tick(1);

    expect(lastQuery()).toEqual(expect.objectContaining({ search: 'john', page: 1 }));
    expect(component.familyPage).toBe(1);
  }));

  it('resets to the first page when a filter changes', () => {
    openProject([familyRow()], 45);
    const component = fixture.componentInstance;
    component.onFamilyPageChange(2);

    component.familyStatusFilter = 'partial';
    component.onFamilyFilterChange();
    expect(lastQuery()).toEqual(expect.objectContaining({ status: 'partial', page: 1 }));

    component.onFamilyPageChange(2);
    component.familyBccFilter = 'bcc-1';
    component.onFamilyFilterChange();
    expect(lastQuery()).toEqual(expect.objectContaining({ status: 'partial', bcc_id: 'bcc-1', page: 1 }));
  });

  it('sorts on header click in both directions and resets to the first page', () => {
    openProject([familyRow()], 45);
    fixture.componentInstance.onFamilyPageChange(2);

    const header = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('th'))
      .find((th) => th.textContent?.includes('Collected')) as HTMLElement;
    header.click();
    fixture.detectChanges();
    expect(lastQuery()).toEqual(expect.objectContaining({ sort: 'amount_collected', direction: 'asc', page: 1 }));
    expect(header.getAttribute('aria-sort')).toBe('ascending');

    header.click();
    fixture.detectChanges();
    expect(lastQuery()).toEqual(expect.objectContaining({ sort: 'amount_collected', direction: 'desc', page: 1 }));
    expect(header.getAttribute('aria-sort')).toBe('descending');
  });

  it('keeps filters while paging and returns to page one when page size changes', () => {
    openProject([familyRow()], 45);
    const component = fixture.componentInstance;
    component.familyStatusFilter = 'not_started';
    component.onFamilyFilterChange();

    component.onFamilyPageChange(2);
    expect(lastQuery()).toEqual(expect.objectContaining({ status: 'not_started', page: 2 }));

    component.onFamilyPageSizeChange(50);
    expect(lastQuery()).toEqual(expect.objectContaining({ status: 'not_started', page: 1, per_page: 50 }));
  });

  it('clears search and filters in one step', () => {
    openProject();
    const component = fixture.componentInstance;
    component.familySearch = 'john';
    component.familyStatusFilter = 'completed';
    component.familyBccFilter = 'unassigned';
    fixture.detectChanges();
    expect(component.hasFamilyFilters).toBe(true);

    component.clearFamilyFilters();

    expect(component.hasFamilyFilters).toBe(false);
    expect(lastQuery()).toEqual(expect.objectContaining({ search: undefined, status: undefined, bcc_id: undefined, page: 1 }));
  });

  it('shows a no-match message instead of the table when nothing matches', () => {
    openProject([], 0);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.project-detail-modal__table')).toBeFalsy();
    expect(el.querySelector('app-pagination')).toBeFalsy();
    expect(el.textContent).toContain('No families match your search or filters.');
  });

  it('shows a retryable error when the family list fails to load', () => {
    getProjectFamilyProgress.mockReturnValue(throwError(() => ({ error: { message: 'Server unavailable' } })));
    fixture.componentInstance.projects = [project];
    fixture.componentInstance.viewDashboard(project);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.cf-state--error')?.textContent).toContain('Server unavailable');

    getProjectFamilyProgress.mockReturnValue(of(familyProgressResponse([familyRow()])));
    fixture.componentInstance.reloadFamilyProgress();
    fixture.detectChanges();
    expect(fixture.componentInstance.familyLoadError).toBeNull();
    expect(fixture.componentInstance.familyRows.length).toBe(1);
  });

  it('opens Collect Payment with the family and project from the selected row', () => {
    openProject([familyRow()]);
    fixture.componentInstance.collectForFamily(fixture.componentInstance.familyRows[0]);
    expect(quickCollect.open).toHaveBeenCalledWith({
      familyId: 'fam-1',
      projectId: 'proj-1',
    });
  });

  it('ignores a late response after switching to another project', () => {
    const pending = new Subject<ProjectFamilyProgressResponse>();
    const other: DonationProject = { ...project, id: 'proj-2', name: 'Roof Repair' };
    getProjectFamilyProgress
      .mockReturnValueOnce(pending.asObservable())
      .mockReturnValueOnce(of(familyProgressResponse([familyRow({ family_code: 'ROOF01' })])));
    fixture.componentInstance.projects = [project, other];

    fixture.componentInstance.viewDashboard(project);
    fixture.componentInstance.familySearch = 'old';
    fixture.componentInstance.viewDashboard(other);
    pending.next(familyProgressResponse([familyRow({ family_code: 'HALL01' })]));

    expect(fixture.componentInstance.familySearch).toBe('');
    expect(fixture.componentInstance.familyRows.map((row) => row.family_code)).toEqual(['ROOF01']);
    expect(getProjectFamilyProgress).toHaveBeenLastCalledWith('proj-2', expect.objectContaining({ page: 1 }));
  });

  it('resets the family table when the modal closes', () => {
    openProject();
    fixture.componentInstance.familyStatusFilter = 'partial';

    fixture.componentInstance.closeProjectDetail();

    expect(fixture.componentInstance.familyRows).toEqual([]);
    expect(fixture.componentInstance.familyStatusFilter).toBe('');
    expect(fixture.componentInstance.familyTotal).toBe(0);
  });

  function familyRow(partial: Partial<ProjectFamilyProgressRow> = {}): ProjectFamilyProgressRow {
    return {
      family_id: 'fam-1',
      family_code: 'FAM001',
      family_name: 'Peter Household',
      head_of_family: 'John Peter',
      bcc_id: null,
      bcc_name: null,
      target_amount: 100,
      amount_collected: 0,
      outstanding_amount: 100,
      completion_percentage: 0,
      status: 'not_started',
      ...partial,
    };
  }

  function familyProgressResponse(
    rows: ProjectFamilyProgressRow[],
    total = rows.length,
    bccs: Array<{ id: string; name: string }> = []
  ): ProjectFamilyProgressResponse {
    return {
      success: true,
      data: { data: rows, total, current_page: 1, last_page: Math.max(1, Math.ceil(total / 20)), per_page: 20 },
      meta: { filter_options: { bccs } },
    };
  }

  function dashboardFor(detailProject: DonationProject, enrolled = 1): ProjectDashboard {
    return {
      project: detailProject,
      totals: {
        overall_target: 100,
        family_target_total: 100,
        collected: 0,
        outstanding: 100,
        installment_outstanding: 0,
        collection_percentage: 0,
      },
      families: { enrolled, completed: 0, partial: 0, exempt: 0 },
      family_progress: [],
      installments: { total: 0, paid: 0, pending: 0 },
    };
  }
});
