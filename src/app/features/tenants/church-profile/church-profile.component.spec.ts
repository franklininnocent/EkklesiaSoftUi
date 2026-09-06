import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { provideStore } from '@ngrx/store';
import { ChurchProfileComponent } from './church-profile.component';
import { TenantService } from '@core/services/tenant.service';
import { FamilyService } from '@core/services/family.service';
import { BCCService } from '@core/services/bcc.service';
import { ToastService } from '@core/services/toast.service';
import { AuthService } from '@core/services/auth.service';
import {
  DenominationService,
  ArchdioceseService,
  ChurchProfileService,
  ChurchLeadershipService,
  ChurchLeadershipGovernanceService,
  ChurchStatisticsService,
  ChurchSocialMediaService,
  PopeDetailsService,
} from '@core/services/church';
import { GeographyService } from '@core/services/geography.service';
import { PhoneCodeService } from '@core/services/phone-code.service';
import { CurrentLeadershipResponse } from '@core/models/church';

describe('ChurchProfileComponent', () => {
  const governanceCurrent: CurrentLeadershipResponse = {
    church_profile_id: 1,
    active_count: 3,
    groups: [],
    assignments: [
      {
        id: 'pastor-assignment',
        tenant_id: 1,
        church_profile_id: 1,
        person_id: 'pastor-person',
        person: {
          id: 'pastor-person',
          full_name: 'Fr. John Pastor',
          first_name: 'John',
          last_name: 'Pastor',
        },
        role_id: 'pastor-role',
        role: {
          id: 'pastor-role',
          title: 'Pastor',
          category: 'PARISH_CLERGY',
          category_label: 'Parish Clergy',
          hierarchical_level: 2,
          allows_concurrent: false,
        },
        start_date: '2024-01-01',
        status: 'active',
      },
      {
        id: 'vicar-assignment',
        tenant_id: 1,
        church_profile_id: 1,
        person_id: 'vicar-person',
        person: {
          id: 'vicar-person',
          full_name: 'Fr. Paul Vicar',
          first_name: 'Paul',
          last_name: 'Vicar',
        },
        role_id: 'vicar-role',
        role: {
          id: 'vicar-role',
          title: 'Parochial Vicar',
          category: 'PARISH_CLERGY',
          category_label: 'Parish Clergy',
          hierarchical_level: 2,
          allows_concurrent: true,
        },
        start_date: '2024-02-01',
        status: 'active',
      },
      {
        id: 'deacon-assignment',
        tenant_id: 1,
        church_profile_id: 1,
        person_id: 'deacon-person',
        person: {
          id: 'deacon-person',
          full_name: 'Mark Deacon',
          first_name: 'Mark',
          last_name: 'Deacon',
        },
        role_id: 'deacon-role',
        role: {
          id: 'deacon-role',
          title: 'Deacon',
          category: 'PARISH_CLERGY',
          category_label: 'Parish Clergy',
          hierarchical_level: 2,
          allows_concurrent: true,
        },
        start_date: '2024-03-01',
        status: 'active',
      },
    ],
  };

  let component: ChurchProfileComponent;
  let fixture: ComponentFixture<ChurchProfileComponent>;
  let toastService: { success: jest.Mock; error: jest.Mock; warning: jest.Mock; info: jest.Mock };
  let authService: {
    currentUserValue: Record<string, unknown> | null;
    hasPermission: jest.Mock;
    isTenantAdmin: jest.Mock;
  };

  function setup(canEdit = true): void {
    toastService = {
      success: jest.fn(),
      error: jest.fn(),
      warning: jest.fn(),
      info: jest.fn(),
    };
    authService = {
      currentUserValue: { tenant_id: 1, is_primary_admin: canEdit },
      hasPermission: jest.fn(() => canEdit),
      isTenantAdmin: jest.fn(() => canEdit),
    };

    TestBed.configureTestingModule({
      imports: [ChurchProfileComponent],
      providers: [
        provideRouter([]),
        provideStore({}),
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: of({ tab: 'profile' }),
          },
        },
        {
          provide: TenantService,
          useValue: {
            getChurchProfile: jest.fn(() => of({ success: true, data: { id: 1, name: 'Holy Family Parish' } })),
          },
        },
        { provide: FamilyService, useValue: { getStatistics: jest.fn(() => of({ success: true, data: {} })) } },
        { provide: BCCService, useValue: { getStatistics: jest.fn(() => of({ success: true, data: {} })) } },
        { provide: ToastService, useValue: toastService },
        { provide: AuthService, useValue: authService },
        { provide: DenominationService, useValue: { getDenominations: jest.fn(() => of({ success: true, data: [] })) } },
        { provide: ArchdioceseService, useValue: { getArchdioceses: jest.fn(() => of({ success: true, data: [] })) } },
        { provide: ChurchProfileService, useValue: { getProfile: jest.fn(() => of({ success: true, data: { id: 1, denomination_id: null } })) } },
        { provide: ChurchLeadershipService, useValue: { getLeaders: jest.fn(() => of({ success: true, data: [] })) } },
        {
          provide: ChurchLeadershipGovernanceService,
          useValue: { getCurrent: jest.fn(() => of({ success: true, data: governanceCurrent })) },
        },
        { provide: ChurchStatisticsService, useValue: { getStatistics: jest.fn(() => of({ success: true, data: [] })) } },
        { provide: ChurchSocialMediaService, useValue: { getSocialMedia: jest.fn(() => of({ success: true, data: [] })) } },
        { provide: PopeDetailsService, useValue: { getPopeDetails: jest.fn(() => of({ success: true, data: null })) } },
        { provide: GeographyService, useValue: { getCountries: jest.fn(() => of([])) } },
        { provide: PhoneCodeService, useValue: { getPhoneCodes: jest.fn(() => of([])), getPhoneCodeSync: jest.fn(() => '+91') } },
      ],
    });

    fixture = TestBed.createComponent(ChurchProfileComponent);
    component = fixture.componentInstance;
    component.governanceCurrent = governanceCurrent;
    fixture.detectChanges();
  }

  describe('governance priest display', () => {
    beforeEach(() => setup(true));

    it('returns governance pastor for getParishPriest', () => {
      const priest = component.getParishPriest();
      expect(priest?.full_name).toBe('Fr. John Pastor');
      expect(priest?.role).toBe('Pastor');
    });

    it('includes parochial vicar and deacon in getAssistantPriests', () => {
      const assistants = component.getAssistantPriests();
      expect(assistants.map((row) => row.full_name)).toEqual(['Fr. Paul Vicar', 'Mark Deacon']);
    });

    it('uses governance active_count for leadership tab badge', () => {
      expect(component.leadershipTabBadgeCount).toBe(3);
    });
  });

  describe('permissions and UX stubs', () => {
    it('grants edit when church.settings.edit is present', () => {
      setup(true);
      expect(component.canEdit).toBe(true);
    });

    it('denies edit for viewer without church.settings.edit', () => {
      setup(false);
      expect(component.canEdit).toBe(false);
    });

    it('shows permission warning when viewer opens general modal', () => {
      setup(false);
      component.openGeneralModal();
      expect(toastService.warning).toHaveBeenCalledWith('You do not have permission to edit.', 'Permission Denied');
    });

    it('shows Coming Soon toast for report and public profile actions', () => {
      setup(true);
      component.onGenerateReport();
      component.onViewPublicProfile();
      expect(toastService.info).toHaveBeenCalledWith(
        'Report generation will be available in a future release.',
        'Coming Soon',
      );
      expect(toastService.info).toHaveBeenCalledWith(
        'Public profile preview will be available in a future release.',
        'Coming Soon',
      );
    });

    it('copies contact values to clipboard', fakeAsync(() => {
      setup(true);
      const writeText = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });

      component.copyToClipboard('parish@example.test');
      tick();

      expect(writeText).toHaveBeenCalledWith('parish@example.test');
      expect(toastService.success).toHaveBeenCalledWith('Copied to clipboard', 'Contact');
    }));

    it('switches tabs via setActiveTab', () => {
      setup(true);
      component.setActiveTab('leadership');
      expect(component.activeTab).toBe('leadership');
      component.setActiveTab('statistics');
      expect(component.activeTab).toBe('statistics');
    });
  });
});
