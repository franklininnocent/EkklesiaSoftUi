import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { DioceseService, extractDioceseList } from './diocese.service';
import { environment } from '@environments/environment';

describe('extractDioceseList', () => {
  const dioceses = [
    { id: 1, name: 'Archdiocese of Verapoly' },
    { id: 2, name: 'Diocese of Cochin' },
  ];

  it('reads a top-level data array (current diocese API)', () => {
    expect(extractDioceseList({ success: true, data: dioceses })).toEqual(dioceses);
  });

  it('reads nested Laravel paginator data.data', () => {
    expect(extractDioceseList({
      success: true,
      data: { data: dioceses, current_page: 1, per_page: 20, total: 2 },
    })).toEqual(dioceses);
  });

  it('returns an empty list when the payload is missing', () => {
    expect(extractDioceseList(undefined)).toEqual([]);
    expect(extractDioceseList({ success: true, data: null })).toEqual([]);
  });
});

describe('DioceseService', () => {
  let service: DioceseService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/ecclesiastical/dioceses`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(DioceseService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getDioceseOptions returns the diocese array from a top-level data payload', () => {
    const dioceses = [{ id: 11, name: 'Diocese of Quilon' }];

    service.getDioceseOptions().subscribe((result) => {
      expect(result).toEqual(dioceses);
    });

    const req = httpMock.expectOne((request) => request.url === baseUrl);
    expect(req.request.params.get('per_page')).toBe('1000');
    req.flush({ success: true, data: dioceses, pagination: { total: 1 } });
  });
});
