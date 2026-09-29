import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { ForgotPasswordRequestsPage } from './forgot-password-requests.page';
import { AuthService } from '@core/services/auth.service';
import { PasswordRecoveryService } from '@core/services/password-recovery.service';

describe('ForgotPasswordRequestsPage deep link', () => {
  const requestId = '11111111-2222-4333-8444-555555555555';

  let fixture: ComponentFixture<ForgotPasswordRequestsPage>;
  let recoveryApi: {
    listRequests: jest.Mock;
    getRequest: jest.Mock;
  };
  let router: { navigate: jest.Mock };

  beforeEach(async () => {
    recoveryApi = {
      listRequests: jest.fn().mockReturnValue(of({ data: [] })),
      getRequest: jest.fn().mockReturnValue(
        of({
          data: {
            id: requestId,
            status: 'pending_approval',
            requester_email: 'staff@test.local',
            requester_name: 'Staff',
            requester_role: 'Secretary',
            requester_classification: 'TENANT_USER',
            can_approve: true,
            can_reject: true,
            can_retry_delivery: false,
          },
        })
      ),
    };
    router = { navigate: jest.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [ForgotPasswordRequestsPage],
      providers: [
        { provide: PasswordRecoveryService, useValue: recoveryApi },
        {
          provide: AuthService,
          useValue: {
            canViewPasswordRecoveryRequests: () => true,
            canProcessPasswordRecoveryRequests: () => true,
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({ request: requestId }),
            },
          },
        },
        { provide: Router, useValue: router },
      ],
    })
      .overrideComponent(ForgotPasswordRequestsPage, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordRequestsPage);
    fixture.detectChanges();
  });

  it('opens request detail from query param and clears the deep link', () => {
    expect(recoveryApi.getRequest).toHaveBeenCalledWith(requestId);
    expect(fixture.componentInstance.detailOpen).toBe(true);
    expect(fixture.componentInstance.selected?.id).toBe(requestId);
    expect(router.navigate).toHaveBeenCalled();
  });

  it('shows an error and closes detail when getRequest fails', fakeAsync(() => {
    recoveryApi.getRequest.mockReturnValueOnce(throwError(() => ({ status: 404 })));
    fixture.componentInstance.openDetail({
      id: requestId,
      status: 'pending_approval',
      requester_email: 'staff@test.local',
    } as never);
    tick();

    expect(fixture.componentInstance.error).toBe('Unable to load request details.');
    expect(fixture.componentInstance.detailOpen).toBe(false);
  }));
});
