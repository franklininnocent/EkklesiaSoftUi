import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { SacramentPersonContextService } from './sacrament-person-context.service';
import { environment } from '@environments/environment';

describe('SacramentPersonContextService', () => {
  let service: SacramentPersonContextService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [SacramentPersonContextService],
    });
    service = TestBed.inject(SacramentPersonContextService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('loads context for a family member', () => {
    service.getContext({ family_member_id: 'member-1', workflow: 'MATRIMONY' }).subscribe((ctx) => {
      expect(ctx.subject.family_member_id).toBe('member-1');
    });

    const req = http.expectOne((r) => r.url === `${environment.apiUrl}/sacraments/context`);
    expect(req.request.params.get('family_member_id')).toBe('member-1');
    expect(req.request.params.get('workflow')).toBe('MATRIMONY');
    req.flush({ success: true, data: { subject: { family_member_id: 'member-1' } } });
  });
});
