import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { SupportSessionService } from './support-session.service';
import { environment } from '@environments/environment';
import { SupportSession } from '../models/support-access.model';

describe('SupportSessionService session lifecycle', () => {
  let service: SupportSessionService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/support`;

  function activeSession(id: string): SupportSession {
    return {
      id,
      support_user_id: 1,
      tenant_id: 42,
      mode: 'standard',
      reason_code: 'diagnosis',
      status: 'active',
      started_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [SupportSessionService],
    });
    service = TestBed.inject(SupportSessionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('getActive late response does not overwrite a newer started session', () => {
    service.getActive().subscribe();
    const activeReq = httpMock.expectOne(`${base}/sessions/active`);

    service
      .start({
        tenant_id: 42,
        mode: 'standard',
        reason_code: 'diagnosis',
        password: 'secret',
      })
      .subscribe();
    const startReq = httpMock.expectOne(`${base}/sessions`);
    startReq.flush({ success: true, data: activeSession('session-b') });

    expect(service.sessionId).toBe('session-b');

    activeReq.flush({ success: true, data: activeSession('session-a') });
    expect(service.sessionId).toBe('session-b');
  });

  it('getActive HTTP error does not clear a live session', () => {
    (service as any).setSession(activeSession('session-live'));

    service.getActive().subscribe();
    const activeReq = httpMock.expectOne(`${base}/sessions/active`);
    activeReq.error(new ProgressEvent('error'));

    expect(service.sessionId).toBe('session-live');
  });

  it('recordEvent 403 for stale session id does not clear the current session', () => {
    (service as any).setSession(activeSession('session-a'));

    service
      .recordEvent({
        event_type: 'navigation',
        module: 'layout',
        page: '/dashboard',
      })
      .subscribe();

    const eventsReq = httpMock.expectOne(`${base}/sessions/session-a/events`);
    (service as any).setSession(activeSession('session-b'));

    eventsReq.flush(
      { message: 'Support session is no longer active.' },
      { status: 403, statusText: 'Forbidden' }
    );

    expect(service.sessionId).toBe('session-b');
  });

  it('recordEvent 403 for the current session clears it', () => {
    (service as any).setSession(activeSession('session-a'));

    service
      .recordEvent({
        event_type: 'navigation',
        module: 'layout',
        page: '/dashboard',
      })
      .subscribe();

    const eventsReq = httpMock.expectOne(`${base}/sessions/session-a/events`);
    eventsReq.flush(
      { message: 'Support session is no longer active.' },
      { status: 403, statusText: 'Forbidden' }
    );

    expect(service.sessionId).toBeNull();
  });

  it('invalidateIfMatchesCurrent only clears when ids match', () => {
    (service as any).setSession(activeSession('session-a'));

    expect(service.invalidateIfMatchesCurrent('session-b')).toBe(false);
    expect(service.sessionId).toBe('session-a');

    expect(service.invalidateIfMatchesCurrent('session-a')).toBe(true);
    expect(service.sessionId).toBeNull();
  });

  it('failed start does not drop an existing local session', () => {
    (service as any).setSession(activeSession('session-a'));

    service
      .start({
        tenant_id: 42,
        mode: 'standard',
        reason_code: 'diagnosis',
        password: 'wrong',
      })
      .subscribe({ error: () => {} });

    const startReq = httpMock.expectOne(`${base}/sessions`);
    startReq.flush(
      { message: 'Invalid password.' },
      { status: 422, statusText: 'Unprocessable Entity' }
    );

    expect(service.sessionId).toBe('session-a');
  });
});
