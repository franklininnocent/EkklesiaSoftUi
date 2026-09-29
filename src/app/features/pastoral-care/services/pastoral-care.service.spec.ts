import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@environments/environment';
import { PastoralCareService } from './pastoral-care.service';

describe('PastoralCareService', () => {
  let service: PastoralCareService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(PastoralCareService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('creates a visit request for a family', () => {
    service
      .create({
        family_id: 'fam-1',
        type: 'home_visit',
        summary: 'Home visit',
      })
      .subscribe((row) => {
        expect(row.id).toBe('req-1');
        expect(row.status).toBe('open');
      });

    const req = http.expectOne(`${environment.apiUrl}/tenant/pastoral/requests`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.family_id).toBe('fam-1');
    req.flush({ success: true, data: { id: 'req-1', status: 'open' } });
  });

  it('assigns a named staff user', () => {
    service.assign('req-1', 9).subscribe((row) => {
      expect(row.assigned_to_user_id).toBe(9);
    });

    const req = http.expectOne(`${environment.apiUrl}/tenant/pastoral/requests/req-1/assign`);
    expect(req.request.body).toEqual({ assigned_to_user_id: 9 });
    req.flush({ success: true, data: { id: 'req-1', assigned_to_user_id: 9, status: 'assigned' } });
  });
});
