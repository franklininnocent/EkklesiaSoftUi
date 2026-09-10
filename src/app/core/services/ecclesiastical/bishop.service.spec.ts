import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { extractBishopList, extractBishopPagination, BishopService } from './bishop.service';
import { environment } from '@environments/environment';

describe('extractBishopList', () => {
  const bishops = [
    { id: 1, full_name: 'Bishop Alpha' },
    { id: 2, full_name: 'Bishop Beta' },
  ];

  it('reads paginated rows from data.data', () => {
    expect(extractBishopList({
      success: true,
      data: { data: bishops, current_page: 1, total: 2 },
    })).toEqual(bishops);
  });

  it('reads legacy double-wrapped resource rows from data.data.data', () => {
    expect(extractBishopList({
      success: true,
      data: { data: { data: bishops }, current_page: 1, total: 2 },
    })).toEqual(bishops);
  });

  it('reads a top-level data array', () => {
    expect(extractBishopList({ success: true, data: bishops })).toEqual(bishops);
  });
});

describe('extractBishopPagination', () => {
  it('reads pagination metadata from the payload', () => {
    expect(extractBishopPagination({
      success: true,
      data: { data: [], current_page: 2, last_page: 5, total: 80 },
    })).toEqual({ total: 80, currentPage: 2, lastPage: 5 });
  });
});

describe('BishopService HTTP', () => {
  let service: BishopService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/ecclesiastical/bishops`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [BishopService],
    });

    service = TestBed.inject(BishopService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getBishops sends list query params', () => {
    service.getBishops({
      page: 2,
      per_page: 20,
      search: 'Kuzhithurai',
      diocese_id: 115,
      sort_by: 'full_name',
      sort_dir: 'asc',
    }).subscribe();

    const req = httpMock.expectOne((request) =>
      request.url === baseUrl
      && request.params.get('page') === '2'
      && request.params.get('per_page') === '20'
      && request.params.get('search') === 'Kuzhithurai'
      && request.params.get('diocese_id') === '115'
      && request.params.get('sort_by') === 'full_name'
      && request.params.get('sort_dir') === 'asc'
    );

    req.flush({ success: true, data: { data: [], total: 0, current_page: 2, last_page: 1 } });
  });

  it('updateBishop sends PUT to bishop endpoint', () => {
    service.updateBishop(20, { id: 20, email: 'updated@example.com' }).subscribe();

    const req = httpMock.expectOne(`${baseUrl}/20`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ id: 20, email: 'updated@example.com' });

    req.flush({ success: true, data: { id: 20, email: 'updated@example.com' } });
  });

  it('getBishop sends GET to bishop detail endpoint', () => {
    service.getBishop(20).subscribe();

    const req = httpMock.expectOne(`${baseUrl}/20`);
    expect(req.request.method).toBe('GET');

    req.flush({ success: true, data: { id: 20, full_name: 'Most Rev. Albert Anasthas' } });
  });
});
