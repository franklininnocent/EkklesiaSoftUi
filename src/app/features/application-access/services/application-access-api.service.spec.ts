import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ApplicationAccessApiService } from './application-access-api.service';
import { environment } from '@environments/environment';

describe('ApplicationAccessApiService', () => {
  let service: ApplicationAccessApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ApplicationAccessApiService],
    });

    service = TestBed.inject(ApplicationAccessApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads dashboard metrics', () => {
    const payload = {
      generated_at: '2026-09-11T00:00:00Z',
      windows: {
        last_15_minutes: { label: 'Last 15 minutes', starts_at: '', ends_at: '' },
        today_utc: { label: 'Today (UTC)', starts_at: '', ends_at: '' },
      },
      kpis: {
        active_sessions: 3,
        failed_sign_ins_15m: 1,
        blocked_attempts_15m: 0,
        support_sessions: 0,
        needs_attention_15m: 0,
        failed_sign_ins_today_utc: 2,
        blocked_attempts_today_utc: 0,
      },
    };

    service.getDashboard().subscribe((dashboard) => {
      expect(dashboard.kpis.active_sessions).toBe(3);
    });

    const request = httpMock.expectOne(`${environment.apiUrl}/admin/application-access/dashboard`);
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, data: payload });
  });

  it('lists sessions with pagination params', () => {
    service.listSessions({ page: 2, per_page: 25, status: 'ACTIVE' }).subscribe((response) => {
      expect(response.data).toHaveLength(1);
      expect(response.meta.total).toBe(1);
    });

    const request = httpMock.expectOne(
      (req) =>
        req.url === `${environment.apiUrl}/admin/application-access/sessions` &&
        req.params.get('page') === '2' &&
        req.params.get('per_page') === '25' &&
        req.params.get('status') === 'ACTIVE'
    );
    request.flush({
      success: true,
      data: [{ id: 'sess-1', session_reference: 'AA-1', status: 'ACTIVE' }],
      meta: { current_page: 2, per_page: 25, total: 1, last_page: 1 },
    });
  });
});
