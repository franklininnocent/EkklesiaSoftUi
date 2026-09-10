import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { Router, ActivatedRoute } from '@angular/router';
import { BishopListComponent } from './bishop-list.component';
import {
  BishopService,
  DioceseService,
  EcclesiasticalTitleService,
  extractBishopList,
  extractBishopPagination,
} from '@core/services/ecclesiastical';
import { ToastService } from '@core/services';
import { Bishop } from '@core/models/ecclesiastical';

describe('BishopListComponent', () => {
  let component: BishopListComponent;
  let fixture: ComponentFixture<BishopListComponent>;

  const bishops: Bishop[] = [
    {
      id: 1,
      full_name: 'Most Rev. Albert Anasthas',
      status: 'active',
      archdiocese: { id: 115, name: 'Kuzhithurai' },
      ecclesiastical_title: { id: 2, title: 'Bishop' },
    } as Bishop,
    {
      id: 2,
      full_name: 'Most Rev. Jerome Dhas Varuvel',
      status: 'retired',
      archdiocese: { id: 115, name: 'Kuzhithurai' },
      ecclesiastical_title: { id: 2, title: 'Bishop' },
    } as Bishop,
  ];

  const listResponse = {
    success: true,
    data: {
      data: bishops,
      current_page: 1,
      last_page: 1,
      total: 2,
    },
  };

  const bishopServiceStub = {
    getBishops: jest.fn().mockReturnValue(of(listResponse)),
    getBishop: jest.fn().mockReturnValue(of({ success: true, data: bishops[0] })),
    deleteBishop: jest.fn().mockReturnValue(of({ success: true })),
  } as unknown as BishopService;

  const dioceseServiceStub = {
    getDioceseOptions: jest.fn().mockReturnValue(of([
      { id: 115, name: 'Kuzhithurai' },
      { id: 116, name: 'Diocese of Quilon' },
    ])),
  } as unknown as DioceseService;

  const titleServiceStub = {
    getTitleOptions: jest.fn().mockReturnValue(of([
      { id: 3, title: 'Archbishop' },
      { id: 4, title: 'Bishop' },
    ])),
  };

  const toastStub = {
    success: jest.fn(),
    error: jest.fn(),
  } as unknown as ToastService;

  const routerStub = {
    navigate: jest.fn(),
  } as unknown as Router;

  const routeStub = {
    queryParamMap: of(new Map()),
    snapshot: { paramMap: new Map() },
  } as unknown as ActivatedRoute;

  beforeEach(async () => {
    jest.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [BishopListComponent],
      providers: [
        { provide: BishopService, useValue: bishopServiceStub },
        { provide: DioceseService, useValue: dioceseServiceStub },
        { provide: EcclesiasticalTitleService, useValue: titleServiceStub },
        { provide: ToastService, useValue: toastStub },
        { provide: Router, useValue: routerStub },
        { provide: ActivatedRoute, useValue: routeStub },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(BishopListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load bishops on init', () => {
    expect(component).toBeTruthy();
    expect(bishopServiceStub.getBishops).toHaveBeenCalled();
    expect(component.bishops.length).toBe(2);
    expect(component.totalItems).toBe(2);
    expect(component.loading).toBe(false);
  });

  it('should send pagination and sort params to API', () => {
    component.currentPage = 2;
    component.perPage = 10;
    component.sortBy = 'ordained_bishop_date';
    component.sortDir = 'desc';
    component.loadBishops();

    expect(bishopServiceStub.getBishops).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        per_page: 10,
        sort_by: 'ordained_bishop_date',
        sort_dir: 'desc',
      })
    );
  });

  it('should debounce quick search and reset to page 1', fakeAsync(() => {
    jest.clearAllMocks();
    component.currentPage = 3;
    component.searchTerm = 'Kuzhithurai';

    component.onQuickSearch();
    tick(299);
    expect(bishopServiceStub.getBishops).not.toHaveBeenCalled();

    tick(1);
    expect(component.currentPage).toBe(1);
    expect(bishopServiceStub.getBishops).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'Kuzhithurai', page: 1 })
    );
  }));

  it('should clear search and reload list', () => {
    jest.clearAllMocks();
    component.searchTerm = 'Albert';
    component.clearSearch();

    expect(component.searchTerm).toBe('');
    expect(component.currentPage).toBe(1);
    expect(bishopServiceStub.getBishops).toHaveBeenCalledWith(
      expect.not.objectContaining({ search: expect.anything() })
    );
  });

  it('should map advanced search filters to API params', () => {
    jest.clearAllMocks();

    component.onAdvancedSearch({
      full_name: 'Albert',
      diocese_id: 115,
      title_id: 2,
      status: 'active',
    });

    expect(component.searchTerm).toBe('Albert');
    expect(component.selectedDiocese).toBe(115);
    expect(component.selectedTitle).toBe(2);
    expect(component.selectedStatus).toBe('active');
    expect(component.currentPage).toBe(1);
    expect(bishopServiceStub.getBishops).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'Albert',
        diocese_id: 115,
        title_id: 2,
        status: 'active',
      })
    );
  });

  it('should toggle sort direction when same column clicked twice', () => {
    jest.clearAllMocks();
    component.sortBy = 'full_name';
    component.sortDir = 'asc';

    component.onSort('full_name');
    expect(component.sortDir).toBe('desc');

    component.onSort('full_name');
    expect(component.sortDir).toBe('asc');
    expect(bishopServiceStub.getBishops).toHaveBeenCalled();
  });

  it('should fetch bishop detail before opening edit modal', () => {
    component.onEditBishop(bishops[1]);

    expect(bishopServiceStub.getBishop).toHaveBeenCalledWith(2);
    expect(component.showFormModal).toBe(true);
    expect(component.selectedBishop?.id).toBe(1);
    expect(component.selectedBishop?.full_name).toBe('Most Rev. Albert Anasthas');
  });

  it('should navigate to detail page on view', () => {
    component.onViewBishop(bishops[0]);

    expect(routerStub.navigate).toHaveBeenCalledWith([
      '/settings/ecclesiastical/bishops',
      1,
    ]);
  });

  it('should reload list from page 1 after successful save', () => {
    jest.clearAllMocks();
    component.currentPage = 4;

    component.onFormSaved(bishops[0]);

    expect(component.showFormModal).toBe(false);
    expect(component.selectedBishop).toBeNull();
    expect(component.currentPage).toBe(1);
    expect(bishopServiceStub.getBishops).toHaveBeenCalled();
  });

  it('should show error toast when list API fails', () => {
    (bishopServiceStub.getBishops as jest.Mock).mockReturnValueOnce(
      throwError(() => new Error('network'))
    );

    component.loadBishops();

    expect(toastStub.error).toHaveBeenCalledWith('Failed to load bishops');
    expect(component.loading).toBe(false);
  });

  it('should handle empty API response gracefully', () => {
    (bishopServiceStub.getBishops as jest.Mock).mockReturnValueOnce(
      of({ success: false })
    );

    component.loadBishops();

    expect(component.bishops).toEqual([]);
    expect(component.totalItems).toBe(0);
  });

  it('should use extractBishopList for paginated response shape', () => {
    const extracted = extractBishopList(listResponse);
    const pagination = extractBishopPagination(listResponse);

    expect(extracted).toEqual(bishops);
    expect(pagination.total).toBe(2);
    expect(pagination.currentPage).toBe(1);
  });

  it('should remove individual filter chip and reload', () => {
    jest.clearAllMocks();
    component.advancedSearchValues = { diocese_id: 115 };
    component.selectedDiocese = 115;

    component.removeFilter({
      key: 'diocese_id',
      label: 'Diocese',
      value: 115,
      displayValue: 'Kuzhithurai',
    });

    expect(component.selectedDiocese).toBeNull();
    expect(bishopServiceStub.getBishops).toHaveBeenCalled();
  });
});
