import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { errorInterceptor } from './error.interceptor';
import { SupportSessionService } from '@features/support-center/services/support-session.service';
import { ToastService } from '@core/services/toast.service';
import { AuthService } from '@core/services/auth.service';

describe('errorInterceptor support session handling', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let invalidateSpy: jest.Mock;
  let toastError: jest.Mock;
  let routerNavigate: jest.Mock;

  beforeEach(() => {
    invalidateSpy = jest.fn().mockReturnValue(false);
    toastError = jest.fn();
    routerNavigate = jest.fn();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigate: routerNavigate } },
        { provide: ToastService, useValue: { error: toastError } },
        { provide: AuthService, useValue: { clearAuthState: jest.fn() } },
        {
          provide: SupportSessionService,
          useValue: {
            invalidateIfMatchesCurrent: invalidateSpy,
          },
        },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('does not toast or redirect when 403 is for a stale session header', () => {
    http
      .get('/api/families/statistics', {
        headers: { 'X-Support-Session-Id': 'session-a' },
      })
      .subscribe({ error: () => {} });

    const req = httpMock.expectOne('/api/families/statistics');
    req.flush(
      { message: 'Support session is no longer active.' },
      { status: 403, statusText: 'Forbidden' }
    );

    expect(invalidateSpy).toHaveBeenCalledWith('session-a');
    expect(toastError).not.toHaveBeenCalled();
    expect(routerNavigate).not.toHaveBeenCalled();
  });

  it('toasts and redirects when the current session is invalidated', () => {
    invalidateSpy.mockReturnValue(true);

    http
      .get('/api/families/statistics', {
        headers: { 'X-Support-Session-Id': 'session-b' },
      })
      .subscribe({ error: () => {} });

    const req = httpMock.expectOne('/api/families/statistics');
    req.flush(
      { message: 'Support session is no longer active.' },
      { status: 403, statusText: 'Forbidden' }
    );

    expect(invalidateSpy).toHaveBeenCalledWith('session-b');
    expect(toastError).toHaveBeenCalled();
    expect(routerNavigate).toHaveBeenCalledWith(['/support-center']);
  });

  it('does not toast for support session events 403 even when invalidated', () => {
    invalidateSpy.mockReturnValue(true);

    http.post('/api/support/sessions/session-b/events', {}).subscribe({ error: () => {} });

    const req = httpMock.expectOne('/api/support/sessions/session-b/events');
    req.flush(
      { message: 'Support session is no longer active.' },
      { status: 403, statusText: 'Forbidden' }
    );

    expect(invalidateSpy).toHaveBeenCalledWith('session-b');
    expect(toastError).not.toHaveBeenCalled();
    expect(routerNavigate).not.toHaveBeenCalled();
  });
});
