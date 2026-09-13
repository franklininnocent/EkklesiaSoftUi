import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { MinistriesApiService } from '@features/ministries-associations/services/ministries-api.service';
import { FamilyAffiliationsPanelComponent } from './family-affiliations-panel.component';

describe('FamilyAffiliationsPanelComponent (module-status)', () => {
  let fixture: ComponentFixture<FamilyAffiliationsPanelComponent>;
  let ministriesApi: { getModuleStatus: jest.Mock };
  let auth: {
    hasParishContext: jest.Mock;
    isSuperAdmin: jest.Mock;
    isEkklesiaAdmin: jest.Mock;
    hasPermission: jest.Mock;
  };

  beforeEach(async () => {
    FamilyAffiliationsPanelComponent.clearModuleEnabledCache();

    ministriesApi = {
      getModuleStatus: jest.fn(() =>
        of({ success: true, data: { enabled: true, feature_key: 'ministries_associations' } })
      ),
    };
    auth = {
      hasParishContext: jest.fn(() => false),
      isSuperAdmin: jest.fn(() => false),
      isEkklesiaAdmin: jest.fn(() => true),
      hasPermission: jest.fn(() => false),
    };

    await TestBed.configureTestingModule({
      imports: [FamilyAffiliationsPanelComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: MinistriesApiService, useValue: ministriesApi },
        { provide: ToastService, useValue: { success: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FamilyAffiliationsPanelComponent);
    fixture.componentRef.setInput('familyMemberId', 'member-1');
  });

  it('does not call tenant module-status without parish context', () => {
    fixture.detectChanges();

    expect(ministriesApi.getModuleStatus).not.toHaveBeenCalled();
    expect(fixture.componentInstance.panelVisible).toBe(false);
  });

  it('calls tenant module-status when parish context exists', () => {
    auth.hasParishContext.mockReturnValue(true);

    fixture.detectChanges();

    expect(ministriesApi.getModuleStatus).toHaveBeenCalledTimes(1);
  });
});
