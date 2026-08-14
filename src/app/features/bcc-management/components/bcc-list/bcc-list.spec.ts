import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { BCCListComponent } from './bcc-list';
import { BCCService } from '../../../../core/services/bcc.service';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

class BCCServiceMock {
  lastFilters: any | null = null;
  getBCCs = jest.fn((filters?: any) => {
    this.lastFilters = filters;
    return of({
      success: true,
      data: [
        { id: '1', tenant_id: 1, bcc_code: 'BCC001', name: 'Alpha', status: 'active', current_family_count: 3, created_at: new Date().toISOString() },
        { id: '2', tenant_id: 1, bcc_code: 'BCC002', name: 'Beta', status: 'inactive', current_family_count: 0, created_at: new Date().toISOString() }
      ],
      total: 2,
      current_page: filters?.page || 1,
      last_page: 1,
      per_page: filters?.per_page || 20,
      from: 1,
      to: 2
    });
  });
  getStatistics = jest.fn(() => of({ success: true, data: { total_bccs: 2, active_bccs: 1, total_families_in_bccs: 3, total_leaders: 0 } }));
}

describe('BCCListComponent', () => {
  let component: BCCListComponent;
  let fixture: ComponentFixture<BCCListComponent>;
  let service: BCCServiceMock;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommonModule, FormsModule, ReactiveFormsModule, BCCListComponent],
      providers: [
        provideRouter([]),
        { provide: BCCService, useClass: BCCServiceMock },
        { provide: AuthService, useValue: { isTenantAdmin: () => true } },
        { provide: ToastService, useValue: { success: jest.fn(), error: jest.fn() } },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BCCListComponent);
    component = fixture.componentInstance;
    service = TestBed.inject(BCCService) as unknown as BCCServiceMock;
    fixture.detectChanges();
  });

  it('loads initial list and statistics', () => {
    expect(service.getStatistics).toHaveBeenCalled();
    expect(service.getBCCs).toHaveBeenCalled();
    expect(component.bccs.length).toBeGreaterThan(0);
  });

  it('applies quick search and triggers debounced load', fakeAsync(() => {
    service.getBCCs.mockClear();
    component.onListSearchChange('mary');
    tick(300);
    expect(service.getBCCs).toHaveBeenCalled();
    expect(service.lastFilters.search).toBe('mary');
    expect(component.currentPage).toBe(1);
  }));

  it('applies advanced search filters and resets to page 1', () => {
    service.getBCCs.mockClear();
    component.currentPage = 3;
    component.onAdvancedSearch({ status: 'active', has_space: '1', meeting_day: 'monday' });
    expect(service.getBCCs).toHaveBeenCalled();
    expect(service.lastFilters.status).toBe('active');
    expect(service.lastFilters.has_space).toBe('1');
    expect(service.lastFilters.meeting_day).toBe('monday');
    expect(component.currentPage).toBe(1);
  });

  it('clears all filters and reloads', () => {
    service.getBCCs.mockClear();
    component.filterForm.patchValue({ status: 'inactive', has_space: '0', meeting_day: 'tuesday', search: 'foo' });
    component.clearAllFilters();
    expect(service.getBCCs).toHaveBeenCalled();
    expect(service.lastFilters.search).toBeUndefined();
    expect(service.lastFilters.status).toBeUndefined();
    expect(component.currentPage).toBe(1);
  });

  it('handles pagination pageChange event', () => {
    service.getBCCs.mockClear();
    component.onPageChange(2);
    expect(component.currentPage).toBe(2);
    expect(service.getBCCs).toHaveBeenCalled();
    expect(service.lastFilters.page).toBe(2);
  });

  it('handles pagination pageSizeChange event', () => {
    service.getBCCs.mockClear();
    component.onPageSizeChange(50);
    expect(component.perPage).toBe(50);
    expect(component.currentPage).toBe(1);
    expect(service.getBCCs).toHaveBeenCalled();
    expect(service.lastFilters.per_page).toBe(50);
  });

  it('sorts by column toggling sort order', () => {
    service.getBCCs.mockClear();
    component.sortBy('name');
    expect(service.lastFilters.sort_by).toBe('name');
    expect(service.lastFilters.sort_order).toBe('asc');

    component.sortBy('name');
    expect(service.lastFilters.sort_by).toBe('name');
    expect(service.lastFilters.sort_order).toBe('desc');
  });
});


