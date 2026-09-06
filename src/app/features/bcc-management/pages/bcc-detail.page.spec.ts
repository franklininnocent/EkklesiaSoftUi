import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { BccDetailPageComponent } from './bcc-detail.page';
import { BCCService } from '@core/services/bcc.service';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';

class BCCServiceMock {
  getBCC = jest.fn(() =>
    of({
      success: true,
      data: {
        id: 'bcc-1',
        name: 'St Joseph BCC',
        bcc_code: 'BCC0001',
        status: 'active',
        meeting_day: 'sunday',
        meeting_time: '10:00',
      },
    })
  );
}

describe('BccDetailPageComponent', () => {
  let component: BccDetailPageComponent;
  let fixture: ComponentFixture<BccDetailPageComponent>;
  let auth: { hasPermission: jest.Mock };
  let queryParams$: BehaviorSubject<Record<string, string | null>>;
  let router: Router;

  beforeEach(async () => {
    auth = { hasPermission: jest.fn((permission: string) => permission === 'bcc.view') };
    queryParams$ = new BehaviorSubject<Record<string, string | null>>({});

    await TestBed.configureTestingModule({
      imports: [BccDetailPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of({ get: (key: string) => (key === 'id' ? 'bcc-1' : null) }),
            queryParamMap: queryParams$.asObservable(),
          },
        },
        { provide: BCCService, useClass: BCCServiceMock },
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: { success: jest.fn(), error: jest.fn() } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(BccDetailPageComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(BccDetailPageComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
  });

  it('loads BCC detail and defaults to overview tab', () => {
    const api = TestBed.inject(BCCService) as unknown as BCCServiceMock;
    expect(api.getBCC).toHaveBeenCalledWith('bcc-1');
    expect(component.bcc?.name).toBe('St Joseph BCC');
    expect(component.activeTab).toBe('overview');
    expect(component.loading).toBe(false);
  });

  it('reflects edit and member permissions from auth', () => {
    expect(component.canEdit).toBe(false);
    expect(component.canManageMembers).toBe(false);

    auth.hasPermission.mockImplementation((permission: string) =>
      ['bcc.view', 'bcc.edit', 'bcc.manage_members'].includes(permission)
    );
    expect(component.canEdit).toBe(true);
    expect(component.canManageMembers).toBe(true);
  });

  it('switches tabs through the router query param', () => {
    component.setTab('members');
    expect(router.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { tab: 'members' },
      })
    );
  });
});
