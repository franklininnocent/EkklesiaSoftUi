import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { BCCService } from '@core/services/bcc.service';
import { FamilyService } from '@core/services/family.service';
import { MemberService } from '@features/members/services/member.service';
import { SacramentService } from '@features/settings/sacraments/services/sacrament.service';
import { DonationsService } from '@features/donations/services/donations.service';
import { PastoralCareService } from '@features/pastoral-care/services/pastoral-care.service';
import { MinistriesApiService } from '@features/ministries-associations/services/ministries-api.service';
import { SupportSessionService } from '@features/support-center/services/support-session.service';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent (ministries module-status)', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let ministriesApi: { getModuleStatus: jest.Mock };
  let auth: {
    canAccessMinistries: jest.Mock;
    canAccessDonations: jest.Mock;
    canAccessPastoral: jest.Mock;
    hasPermission: jest.Mock;
    isSuperAdmin: jest.Mock;
    isPlatformActor: jest.Mock;
  };
  let supportSessionId: string | null;

  beforeEach(async () => {
    supportSessionId = null;
    ministriesApi = {
      getModuleStatus: jest.fn(() => of({ success: true, data: { enabled: false, feature_key: 'ministries_associations' } })),
    };
    auth = {
      canAccessMinistries: jest.fn(() => false),
      canAccessDonations: jest.fn(() => false),
      canAccessPastoral: jest.fn(() => false),
      hasPermission: jest.fn(() => false),
      isSuperAdmin: jest.fn(() => false),
      isPlatformActor: jest.fn(() => true),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        {
          provide: Store,
          useValue: {
            select: jest.fn(() =>
              of({
                id: 1,
                name: 'Platform Admin',
                tenant_id: null,
                role_name: 'EkklesiaAdmin',
              })
            ),
          },
        },
        { provide: AuthService, useValue: auth },
        {
          provide: SupportSessionService,
          useValue: {
            session$: of(null),
            get sessionId() {
              return supportSessionId;
            },
          },
        },
        { provide: MinistriesApiService, useValue: ministriesApi },
        {
          provide: FamilyService,
          useValue: { getStatistics: jest.fn(() => of({ success: true, data: {} })) },
        },
        {
          provide: BCCService,
          useValue: { getStatistics: jest.fn(() => of({ success: true, data: {} })) },
        },
        {
          provide: MemberService,
          useValue: { getStatistics: jest.fn(() => of({ success: true, data: {} })) },
        },
        {
          provide: SacramentService,
          useValue: { getDashboardSummary: jest.fn(() => of({ success: true, data: {} })) },
        },
        {
          provide: DonationsService,
          useValue: { getOperationsDashboardSummary: jest.fn(() => of({ success: true, data: {} })) },
        },
        {
          provide: PastoralCareService,
          useValue: {
            getDashboardSummary: jest.fn(() => of({ success: true, data: {} })),
            listAlerts: jest.fn(() => of({ success: true, data: [] })),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
  });

  it('does not call tenant module-status for EkklesiaAdmin without parish context', () => {
    auth.canAccessMinistries.mockReturnValue(false);

    fixture.detectChanges();

    expect(ministriesApi.getModuleStatus).not.toHaveBeenCalled();
  });

  it('does not call tenant module-status when platform admin has an active support session', () => {
    supportSessionId = 'session-live';
    auth.canAccessMinistries.mockReturnValue(true);

    fixture.detectChanges();

    expect(ministriesApi.getModuleStatus).not.toHaveBeenCalled();
  });
});
