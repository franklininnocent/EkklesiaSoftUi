import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { FamilyListComponent } from './family-list';
import { FamilyService } from '../../../../core/services/family.service';
import { BCCService } from '../../../../core/services/bcc.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { SubscriptionAccessService } from '@core/services/subscription-access.service';
import { SupportSessionService } from '@features/support-center/services/support-session.service';
import { ConfirmationDialogService } from '@core/services/confirmation-dialog.service';

describe('FamilyListComponent (list + stats)', () => {
  const routerStub = { navigate: jest.fn() };
  const routeStub = {
    snapshot: { queryParamMap: convertToParamMap({}) },
    queryParamMap: of(convertToParamMap({})),
    queryParams: of({})
  };

  const configure = () => {
    const mockFamilyService = {
      getStatistics: jest.fn(() => of({ success: true, data: { total_families: 10 } })),
      getFamilies: jest.fn(() => of({ data: [], current_page: 1, last_page: 1, total: 0 }))
    };
    const mockBccService = { getBCCs: jest.fn(() => of({ data: [] })) };

    TestBed.configureTestingModule({
      imports: [FamilyListComponent],
      providers: [
        { provide: FamilyService, useValue: mockFamilyService },
        { provide: BCCService, useValue: mockBccService },
        { provide: Router, useValue: routerStub },
        { provide: ActivatedRoute, useValue: routeStub },
        {
          provide: AuthService,
          useValue: {
            hasParishContext: jest.fn(() => true),
            isTenantAdmin: jest.fn(() => false),
            hasPermission: jest.fn(() => true),
          },
        },
        { provide: ToastService, useValue: { success: jest.fn(), error: jest.fn(), warning: jest.fn() } },
        { provide: SubscriptionAccessService, useValue: { isReadOnly: jest.fn(() => false) } },
        { provide: SupportSessionService, useValue: { session$: of(null), sessionId: null } },
        { provide: ConfirmationDialogService, useValue: { confirm: jest.fn().mockResolvedValue(true) } },
      ]
    });

    return { mockFamilyService };
  };

  it('loads statistics on init and stores them', () => {
    const { mockFamilyService } = configure();
    const fixture = TestBed.createComponent(FamilyListComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(mockFamilyService.getStatistics).toHaveBeenCalled();
    expect(component.statistics).toEqual(expect.objectContaining({ total_families: 10 }));
  });

  it('computes active filter count from form values', () => {
    configure();
    const fixture = TestBed.createComponent(FamilyListComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.filterForm.patchValue({ status: 'active', city: 'Chennai' });
    expect(component.getActiveFilterCount()).toBe(2);
  });

  it('opens the shared image viewer from a head photo without navigating', () => {
    configure();
    const fixture = TestBed.createComponent(FamilyListComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const family = {
      id: '1',
      family_name: 'Smith',
      head_of_family: 'John Smith',
      head_profile_image_full_url: 'https://example.com/john.jpg'
    } as any;

    const event = { stopPropagation: jest.fn(), preventDefault: jest.fn() } as unknown as Event;
    component.openPhotoViewer(family, event);

    expect(event.stopPropagation).toHaveBeenCalled();
    expect(component.photoViewer?.src).toBe('https://example.com/john.jpg');
    expect(component.photoViewer?.title).toBe('John Smith');
  });
});
