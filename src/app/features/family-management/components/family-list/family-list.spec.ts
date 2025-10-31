import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { FamilyListComponent } from './family-list';
import { FamilyService } from '../../../../core/services/family.service';
import { BCCService } from '../../../../core/services/bcc.service';

describe('FamilyListComponent (list + stats)', () => {
  it('loads statistics on init and stores them', () => {
    const mockFamilyService = {
      getStatistics: jest.fn(() => of({ success: true, data: { total_families: 10 } })),
      getFamilies: jest.fn(() => of({ data: [], current_page: 1, last_page: 1, total: 0 }))
    };
    const mockBccService = { getBCCs: jest.fn(() => of({ data: [] })) };

    TestBed.configureTestingModule({
      imports: [FamilyListComponent],
      providers: [
        { provide: FamilyService, useValue: mockFamilyService },
        { provide: BCCService, useValue: mockBccService }
      ]
    });

    const fixture = TestBed.createComponent(FamilyListComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(mockFamilyService.getStatistics).toHaveBeenCalled();
    expect(component.statistics).toEqual(expect.objectContaining({ total_families: 10 }));
  });

  it('computes active filter count from form values', () => {
    const mockFamilyService = {
      getStatistics: jest.fn(() => of({ success: true, data: {} })),
      getFamilies: jest.fn(() => of({ data: [], current_page: 1, last_page: 1, total: 0 }))
    };
    const mockBccService = { getBCCs: jest.fn(() => of({ data: [] })) };

    TestBed.configureTestingModule({
      imports: [FamilyListComponent],
      providers: [
        { provide: FamilyService, useValue: mockFamilyService },
        { provide: BCCService, useValue: mockBccService }
      ]
    });

    const fixture = TestBed.createComponent(FamilyListComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.filterForm.patchValue({ status: 'active', city: 'Chennai' });
    expect(component.getActiveFilterCount()).toBe(2);
  });
});


