import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { tenantInterceptor } from './tenant.interceptor';
import { SupportSessionService } from '@features/support-center/services/support-session.service';

describe('tenantInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let sessionId: string | null = 'sess-test-123';

  beforeEach(() => {
    sessionId = 'sess-test-123';

    const supportSessions = {
      get sessionId() {
        return sessionId;
      },
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([tenantInterceptor])),
        provideHttpClientTesting(),
        { provide: SupportSessionService, useValue: supportSessions },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('attaches X-Support-Session-Id for tenant APIs when a session is active', () => {
    http.get('/api/tenant/ministries/categories').subscribe();

    const req = httpMock.expectOne('/api/tenant/ministries/categories');
    expect(req.request.headers.get('X-Support-Session-Id')).toBe('sess-test-123');
    req.flush({});
  });

  it('does not attach the header when no session is active', () => {
    sessionId = null;

    http.get('/api/tenant/ministries/categories').subscribe();

    const req = httpMock.expectOne('/api/tenant/ministries/categories');
    expect(req.request.headers.has('X-Support-Session-Id')).toBe(false);
    req.flush({});
  });

  it('skips the header for support session active sync', () => {
    http.get('/api/support/sessions/active').subscribe();

    const req = httpMock.expectOne('/api/support/sessions/active');
    expect(req.request.headers.has('X-Support-Session-Id')).toBe(false);
    req.flush({ success: true, data: null });
  });

  it('skips the header for support session end', () => {
    http.post('/api/support/sessions/sess-test-123/end', {}).subscribe();

    const req = httpMock.expectOne('/api/support/sessions/sess-test-123/end');
    expect(req.request.headers.has('X-Support-Session-Id')).toBe(false);
    req.flush({ success: true, data: {} });
  });

  it('skips the header for ops support tickets', () => {
    http.get('/api/support/tickets').subscribe();

    const req = httpMock.expectOne('/api/support/tickets');
    expect(req.request.headers.has('X-Support-Session-Id')).toBe(false);
    req.flush({ success: true, data: [] });
  });

  it('attaches the header for sacraments parish APIs', () => {
    http.get('/api/sacraments/dashboard/summary').subscribe();

    const req = httpMock.expectOne('/api/sacraments/dashboard/summary');
    expect(req.request.headers.get('X-Support-Session-Id')).toBe('sess-test-123');
    req.flush({ success: true, data: {} });
  });

  it('attaches the header for support session breadcrumb events', () => {
    http.post('/api/support/sessions/sess-test-123/events', { event_type: 'page_view' }).subscribe();

    const req = httpMock.expectOne('/api/support/sessions/sess-test-123/events');
    expect(req.request.headers.get('X-Support-Session-Id')).toBe('sess-test-123');
    req.flush({ success: true, data: {} });
  });
});
