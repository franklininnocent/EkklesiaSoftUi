import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ChurchLeadershipGovernanceService } from './church-leadership-governance.service';
import { environment } from '@environments/environment';

describe('ChurchLeadershipGovernanceService', () => {
  let service: ChurchLeadershipGovernanceService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/church-profile/leadership`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(ChurchLeadershipGovernanceService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads current governance', () => {
    service.getCurrent().subscribe((response) => {
      expect(response.success).toBe(true);
      expect(response.data.active_count).toBe(2);
    });

    const req = httpMock.expectOne(`${baseUrl}/current`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: { active_count: 2, assignments: [], groups: [] } });
  });

  it('loads history with filters stripped when empty', () => {
    service.getHistory({ category: 'PARISH_CLERGY', status: '' }).subscribe();

    const req = httpMock.expectOne((request) => request.url === `${baseUrl}/history`);
    expect(req.request.params.get('category')).toBe('PARISH_CLERGY');
    expect(req.request.params.has('status')).toBe(false);
    req.flush({ success: true, data: [], pagination: { current_page: 1, last_page: 1, per_page: 15, total: 0 } });
  });

  it('assigns a leader', () => {
    const payload = {
      is_external: false as const,
      person_id: 'person-1',
      role_id: 'role-1',
      start_date: '2026-01-01',
    };

    service.assign(payload).subscribe((response) => {
      expect(response.success).toBe(true);
      expect(response.data.id).toBe('assignment-1');
    });

    const req = httpMock.expectOne(`${baseUrl}/assign`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ success: true, data: { id: 'assignment-1' } });
  });

  it('terminates an assignment', () => {
    service.terminate('assignment-1', {
      end_date: '2026-08-31',
      exit_reason_code: 'completed',
    }).subscribe((response) => {
      expect(response.success).toBe(true);
    });

    const req = httpMock.expectOne(`${baseUrl}/assignments/assignment-1/terminate`);
    expect(req.request.method).toBe('PUT');
    req.flush({ success: true, data: { id: 'assignment-1', status: 'completed' } });
  });
});
