import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { SupportContextService } from './support-context.service';
import { AuthService } from './auth.service';
import { SubscriptionAccessService } from './subscription-access.service';
import { SupportSessionService } from '@features/support-center/services/support-session.service';

describe('SupportContextService', () => {
  let service: SupportContextService;
  let sessionsMock: {
    currentSession: any;
    isSessionLive: boolean;
    end: jest.Mock;
    clearSession: jest.Mock;
    start: jest.Mock;
  };
  let routerMock: { navigate: jest.Mock };
  let subscriptionAccessMock: { clear: jest.Mock };

  beforeEach(() => {
    sessionsMock = {
      currentSession: { id: 'sess-1', tenant_id: 10 },
      isSessionLive: true,
      end: jest.fn().mockReturnValue(of({ id: 'sess-1' })),
      clearSession: jest.fn(),
      start: jest.fn().mockReturnValue(of({ id: 'sess-2', tenant_id: 20 })),
    };
    routerMock = { navigate: jest.fn().mockResolvedValue(true) };
    subscriptionAccessMock = { clear: jest.fn() };

    TestBed.configureTestingModule({
      providers: [
        SupportContextService,
        { provide: SupportSessionService, useValue: sessionsMock },
        { provide: AuthService, useValue: { isPlatformActor: jest.fn().mockReturnValue(true) } },
        { provide: SubscriptionAccessService, useValue: subscriptionAccessMock },
        { provide: Router, useValue: routerMock },
      ],
    });

    service = TestBed.inject(SupportContextService);
  });

  it('exitSupportContext ends session, clears overlay, and navigates to dashboard with replaceUrl', (done) => {
    service.exitSupportContext().subscribe(() => {
      expect(sessionsMock.end).toHaveBeenCalledWith('sess-1');
      expect(sessionsMock.clearSession).toHaveBeenCalled();
      expect(subscriptionAccessMock.clear).toHaveBeenCalled();
      expect(routerMock.navigate).toHaveBeenCalledWith(['/dashboard'], { replaceUrl: true });
      done();
    });
  });

  it('replaceSupportContext ends current session before starting a new one', (done) => {
    service.replaceSupportContext({ tenant_id: 20, mode: 'standard', reason_code: 'diagnosis', password: 'secret' } as any)
      .subscribe((session) => {
        expect(sessionsMock.end).toHaveBeenCalledWith('sess-1');
        expect(subscriptionAccessMock.clear).toHaveBeenCalled();
        expect(sessionsMock.start).toHaveBeenCalled();
        expect(session.tenant_id).toBe(20);
        done();
      });
  });

  it('enterSupportContext replaces when a session is already live', (done) => {
    const replaceSpy = jest.spyOn(service, 'replaceSupportContext').mockReturnValue(
      of({ id: 'sess-3', tenant_id: 30 } as any)
    );

    service.enterSupportContext({ tenant_id: 30, mode: 'standard', reason_code: 'diagnosis', password: 'secret' } as any)
      .subscribe(() => {
        expect(replaceSpy).toHaveBeenCalled();
        done();
      });
  });
});
