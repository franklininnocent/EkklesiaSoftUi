import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { BCCService } from './bcc.service';
import { environment } from '@environments/environment';

describe('BCCService', () => {
  let service: BCCService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/bccs`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(BCCService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads paginated BCC list with filters', () => {
    service.getBCCs({ search: 'alpha', status: 'active', page: 2, per_page: 10 }).subscribe((response) => {
      expect(response.success).toBe(true);
      expect(response.data.length).toBe(1);
      expect(response.total).toBe(1);
    });

    const req = httpMock.expectOne((request) => {
      return (
        request.url === baseUrl &&
        request.params.get('search') === 'alpha' &&
        request.params.get('status') === 'active' &&
        request.params.get('page') === '2' &&
        request.params.get('per_page') === '10'
      );
    });
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: [{ id: 'bcc-1', name: 'Alpha BCC', status: 'active' }],
      total: 1,
      current_page: 2,
      last_page: 1,
      per_page: 10,
      from: 1,
      to: 1,
    });
  });

  it('loads parish dashboard and strips empty filter params', () => {
    service.getDashboard({ period: '1y', status: 'all', search: '' }).subscribe((response) => {
      expect(response.success).toBe(true);
    });

    const req = httpMock.expectOne((request) => {
      return request.url === `${baseUrl}/dashboard` && request.params.get('period') === '1y';
    });
    expect(req.request.params.has('status')).toBe(false);
    expect(req.request.params.has('search')).toBe(false);
    req.flush({ success: true, data: { bccs: { total: 3 } } });
  });

  it('creates and updates a BCC', () => {
    const payload = {
      name: 'New BCC',
      status: 'active' as const,
      meeting_day: 'sunday' as const,
    };

    service.createBCC(payload).subscribe((response) => {
      expect(response.success).toBe(true);
      expect(response.data?.id).toBe('bcc-new');
    });
    const createReq = httpMock.expectOne(baseUrl);
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.body).toEqual(payload);
    createReq.flush({ success: true, data: { id: 'bcc-new', ...payload } });

    service.updateBCC('bcc-new', { name: 'Renamed BCC' }).subscribe((response) => {
      expect(response.data?.name).toBe('Renamed BCC');
    });
    const updateReq = httpMock.expectOne(`${baseUrl}/bcc-new`);
    expect(updateReq.request.method).toBe('PUT');
    updateReq.flush({ success: true, data: { id: 'bcc-new', name: 'Renamed BCC' } });
  });

  it('assigns and removes BCC members', () => {
    service.assignMembers('bcc-1', ['family-1'], { transfer: true, joined_date: '2026-09-01' }).subscribe();
    const assignReq = httpMock.expectOne(`${baseUrl}/bcc-1/members`);
    expect(assignReq.request.method).toBe('POST');
    expect(assignReq.request.body).toEqual({
      family_ids: ['family-1'],
      transfer: true,
      joined_date: '2026-09-01',
    });
    assignReq.flush({ success: true, data: {} });

    service.removeMember('bcc-1', 'membership-1', { exit_reason: 'moved' }).subscribe();
    const removeReq = httpMock.expectOne(`${baseUrl}/bcc-1/members/membership-1`);
    expect(removeReq.request.method).toBe('DELETE');
    expect(removeReq.request.body).toEqual({ exit_reason: 'moved' });
    removeReq.flush({ success: true, data: {} });
  });

  it('loads leadership and audit endpoints', () => {
    service.getLeadershipCurrent('bcc-1').subscribe((response) => {
      expect(response.success).toBe(true);
    });
    httpMock.expectOne(`${baseUrl}/bcc-1/leadership/current`).flush({ success: true, data: { active_count: 1 } });

    service.handoverLeadership('bcc-1', { outgoing_leader_id: 'l1', incoming_family_member_id: 'm2' }).subscribe();
    const handoverReq = httpMock.expectOne(`${baseUrl}/bcc-1/leadership/handover`);
    expect(handoverReq.request.method).toBe('POST');
    handoverReq.flush({ success: true, data: {} });

    service.getAuditLogs({ page: 1 }, 'bcc-1').subscribe();
    const auditReq = httpMock.expectOne((request) => {
      return request.url === `${baseUrl}/bcc-1/audit-logs` && request.params.get('page') === '1';
    });
    auditReq.flush({ data: [], meta: { total: 0 } });
  });
});
