import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { BccMembersTabComponent } from './bcc-members-tab.component';
import { BCCService } from '@core/services/bcc.service';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';

class BCCServiceMock {
  getMembers = jest.fn(() =>
    of({
      data: [
        {
          id: 'membership-1',
          family: { id: 'family-1', family_name: 'Martinez', family_code: 'FAM001', status: 'active' },
          joined_date: '2026-01-01',
          is_current: true,
        },
      ],
      meta: { total: 1, current_page: 1, last_page: 1, per_page: 15 },
    })
  );
  getPeople = jest.fn(() =>
    of({
      data: [{
        id: 'person-1',
        first_name: 'Ana',
        last_name: 'Martinez',
        display_name: 'Ana Martinez',
        gender: 'female',
        age: 9,
        status: 'active',
        family_id: 'family-1',
      }],
      meta: { total: 1, current_page: 1, last_page: 1, per_page: 15 },
    })
  );
  lookupFamilies = jest.fn(() => of({ data: [] }));
  assignMembers = jest.fn(() => of({ success: true }));
  removeMember = jest.fn(() => of({ success: true }));
}

describe('BccMembersTabComponent', () => {
  let component: BccMembersTabComponent;
  let fixture: ComponentFixture<BccMembersTabComponent>;
  let auth: { hasPermission: jest.Mock };

  beforeEach(async () => {
    auth = { hasPermission: jest.fn(() => true) };

    await TestBed.configureTestingModule({
      imports: [BccMembersTabComponent],
      providers: [
        provideRouter([]),
        { provide: BCCService, useClass: BCCServiceMock },
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: { success: jest.fn(), error: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BccMembersTabComponent);
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

  it('loads people by default', () => {
    const api = TestBed.inject(BCCService) as unknown as BCCServiceMock;
    expect(api.getPeople).toHaveBeenCalled();
    expect(component.people.length).toBe(1);
    expect(component.loading).toBe(false);
  });

  it('renders people when status, gender, and life stage filters are active', () => {
    const api = TestBed.inject(BCCService) as unknown as BCCServiceMock;
    api.getPeople.mockReturnValue(
      of({
        data: [{
          id: 'person-1',
          first_name: 'Ana',
          last_name: 'Martinez',
          display_name: 'Ana Martinez',
          gender: 'female',
          age: 9,
          status: 'active',
          family_id: 'family-1',
        }],
        meta: { total: 41, current_page: 1, last_page: 3, per_page: 15 },
      })
    );

    component.initialQuery = { status: 'active', gender: 'female', age_band: 'children' };
    component.ngOnChanges({
      initialQuery: {
        currentValue: component.initialQuery,
        previousValue: {},
        firstChange: false,
        isFirstChange: () => false,
      },
    });
    fixture.detectChanges();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(component.loading).toBe(false);
    expect(component.people.length).toBe(1);
    expect(fixture.nativeElement.querySelector('table')).not.toBeNull();
    expect(api.getPeople.mock.calls.length).toBe(2);
    expect(text).not.toContain('No members match these filters');
    expect(text).toContain('Clear filters');
    expect(text).toContain('Ana Martinez');
    expect(text).toContain('Membership status');

    component.onPageChange(1);
    expect(api.getPeople.mock.calls.length).toBe(2);
  });

  it('gates assign actions behind manage_members on active BCC', () => {
    expect(component.canManage).toBe(true);
    expect(component.canAssign).toBe(true);

    auth.hasPermission.mockReturnValue(false);
    expect(component.canManage).toBe(false);
    expect(component.canAssign).toBe(false);

    auth.hasPermission.mockReturnValue(true);
    component.bccStatus = 'inactive';
    fixture.detectChanges();
    expect(component.canAssign).toBe(false);
  });
});
