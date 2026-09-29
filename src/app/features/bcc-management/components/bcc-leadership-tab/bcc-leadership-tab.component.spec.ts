import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { BccLeadershipTabComponent } from './bcc-leadership-tab.component';
import { BCCService } from '@core/services/bcc.service';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';

class BCCServiceMock {
  getLeadershipCurrent = jest.fn(() =>
    of({
      success: true,
      data: {
        active_count: 1,
        leaders: [
          {
            id: 'leader-1',
            role: 'leader',
            is_active: true,
            status: 'active',
            family_member_id: 'member-1',
            display_name: 'Ana Martinez',
          },
        ],
      },
    })
  );
  getLeadershipTimeline = jest.fn(() => of({ data: [], meta: { total: 0 } }));
  getEligibleLeaders = jest.fn(() => of({ success: true, data: [] }));
  assignLeadership = jest.fn(() => of({ success: true, data: {} }));
  handoverLeadership = jest.fn(() => of({ success: true, data: {} }));
  terminateLeadership = jest.fn(() => of({ success: true, data: {} }));
}

describe('BccLeadershipTabComponent', () => {
  let component: BccLeadershipTabComponent;
  let fixture: ComponentFixture<BccLeadershipTabComponent>;
  let auth: { hasPermission: jest.Mock };

  beforeEach(async () => {
    auth = { hasPermission: jest.fn(() => true) };

    await TestBed.configureTestingModule({
      imports: [BccLeadershipTabComponent],
      providers: [
        { provide: BCCService, useClass: BCCServiceMock },
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: { success: jest.fn(), error: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BccLeadershipTabComponent);
    component = fixture.componentInstance;
    component.bccId = 'bcc-1';
    component.bccStatus = 'active';
    component.ngOnChanges({
      bccId: {
        currentValue: 'bcc-1',
        previousValue: undefined,
        firstChange: true,
        isFirstChange: () => true,
      },
    });
    fixture.detectChanges();
  });

  it('loads current leaders', () => {
    const api = TestBed.inject(BCCService) as unknown as BCCServiceMock;
    expect(api.getLeadershipCurrent).toHaveBeenCalled();
    expect(component.leaders.length).toBe(1);
    expect(component.primaryLeader?.id).toBe('leader-1');
    expect(component.loading).toBe(false);
  });

  it('gates leadership management behind manage_leadership on active BCC', () => {
    expect(component.canManage).toBe(true);

    auth.hasPermission.mockReturnValue(false);
    expect(component.canManage).toBe(false);

    auth.hasPermission.mockReturnValue(true);
    component.bccStatus = 'suspended';
    fixture.detectChanges();
    expect(component.canManage).toBe(false);
  });
});
