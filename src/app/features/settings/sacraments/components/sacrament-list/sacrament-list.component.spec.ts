import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { of } from 'rxjs';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { SacramentListComponent } from './sacrament-list.component';
import { SacramentService } from '../../services/sacrament.service';
import { SacramentDefinitionService } from '../../services/sacrament-definition.service';
import { selectCurrentUser } from '@core/store/auth/auth.selectors';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';

describe('SacramentListComponent', () => {
  let component: SacramentListComponent;
  let fixture: ComponentFixture<SacramentListComponent>;
  let store: MockStore;

  const sacramentTypes = [
    { id: 1, name: 'Baptism', code: 'BAPTISM' },
    { id: 2, name: 'Confirmation', code: 'CONFIRMATION' },
    { id: 3, name: 'Marriage', code: 'MARRIAGE' }
  ];

  const sampleData = Array.from({ length: 35 }).map((_, i) => ({
    id: i + 1,
    recipient_name: `Recipient ${i + 1}`,
    sacrament_type_id: (i % 3) + 1,
    date_administered: '2025-01-0' + ((i % 9) + 1),
    status: i % 2 === 0 ? 'registered' : 'voided'
  }));

  const pagedResponse = {
    success: true,
    data: {
      data: sampleData.slice(0, 20),
      total: sampleData.length,
      current_page: 1,
      last_page: 2
    }
  };

  const sacramentServiceStub = {
    getSacramentTypes: jasmine.createSpy('getSacramentTypes').and.returnValue(of({ success: true, data: sacramentTypes })),
    getSacraments: jasmine.createSpy('getSacraments').and.returnValue(of(pagedResponse))
  } as unknown as SacramentService;

  const definitionStub = {
    load: jasmine.createSpy('load').and.returnValue(of({ success: true, data: [], meta: { participants_v1: false } })),
    isParticipantsV1Enabled: () => false
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SacramentListComponent],
      providers: [
        { provide: SacramentService, useValue: sacramentServiceStub },
        { provide: SacramentDefinitionService, useValue: definitionStub },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(convertToParamMap({})),
            snapshot: { queryParamMap: convertToParamMap({}) },
          },
        },
        {
          provide: AuthService,
          useValue: {
            isTenantAdmin: () => true,
            hasPermission: () => true,
          },
        },
        { provide: ToastService, useValue: { success: () => undefined, error: () => undefined, info: () => undefined } },
        provideMockStore({ initialState: {} })
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    store = TestBed.inject(MockStore);
    store.overrideSelector(selectCurrentUser, { id: 1, tenant_id: 10 } as any);

    fixture = TestBed.createComponent(SacramentListComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should load types and sacraments on init', () => {
    fixture.detectChanges();
    expect((sacramentServiceStub.getSacramentTypes as any)).toHaveBeenCalledWith({ includeInactive: true });
    expect((sacramentServiceStub.getSacraments as any)).toHaveBeenCalled();
    expect(component.sacramentTypes.length).toBe(3);
    expect(component.sacraments.length).toBe(20);
    expect(component.totalItems).toBe(35);
  });

  it('applyFilters should reset to page 1 and reload', () => {
    fixture.detectChanges();
    component.currentPage = 2;
    component.searchTerm = 'Rec';
    const before = (sacramentServiceStub.getSacraments as any).mock.calls.length;
    component.applyFilters();
    expect(component.currentPage).toBe(1);
    const after = (sacramentServiceStub.getSacraments as any).mock.calls.length;
    expect(after).toBeGreaterThan(before);
  });

  it('onQuickSearch should reset page and reload when typing', () => {
    fixture.detectChanges();
    component.currentPage = 2;
    component.searchTerm = 'abc';
    const before = (sacramentServiceStub.getSacraments as any).mock.calls.length;
    component.onQuickSearch();
    expect(component.currentPage).toBe(1);
    const after = (sacramentServiceStub.getSacraments as any).mock.calls.length;
    expect(after).toBeGreaterThan(before);
  });

  it('clearFilters should reset all filters and reload', () => {
    fixture.detectChanges();
    component.selectedSacramentType = 2;
    component.selectedStatus = 'active';
    component.dateFrom = '2025-01-01';
    component.dateTo = '2025-02-01';
    component.searchTerm = 'xyz';
    component.currentPage = 3;
    component.clearFilters();
    expect(component.selectedSacramentType).toBeNull();
    expect(component.selectedStatus).toBe('');
    expect(component.dateFrom).toBe('');
    expect(component.dateTo).toBe('');
    expect(component.searchTerm).toBe('');
    expect(component.currentPage).toBe(1);
  });

  it('page and pageSize handlers should trigger reload', () => {
    fixture.detectChanges();
    component.onPageChange(2);
    component.onPageSizeChange(50);
    expect(component.currentPage).toBe(1);
    expect(component.perPage).toBe(50);
  });

  it('getActiveFilterCount reflects active filters and chips render', () => {
    fixture.detectChanges();
    component.selectedSacramentType = 1;
    component.selectedStatus = 'active';
    fixture.detectChanges();
    expect(component.getActiveFilterCount()).toBe(2);
    expect(component.getActiveFilters().length).toBeGreaterThan(0);
  });
});


