import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ChurchProfileService } from './church-profile.service';
import { environment } from '@environments/environment';

describe('ChurchProfileService', () => {
  let service: ChurchProfileService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/church-profile`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(ChurchProfileService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads church profile', () => {
    service.getProfile().subscribe((response) => {
      expect(response.success).toBe(true);
      expect(response.data?.patron_name).toBe('St Anne');
    });

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: { id: 1, patron_name: 'St Anne' } });
  });

  it('updates church profile', () => {
    const payload = { patron_name: 'St Joseph', about: 'Updated' };

    service.updateProfile(payload).subscribe((response) => {
      expect(response.success).toBe(true);
      expect(response.data?.about).toBe('Updated');
    });

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(payload);
    req.flush({ success: true, data: { id: 1, ...payload } });
  });

  it('uploads patron image as multipart form data', () => {
    const file = new File(['image'], 'patron.jpg', { type: 'image/jpeg' });

    service.uploadPatronImage(file).subscribe((response) => {
      expect(response.success).toBe(true);
      expect(response.data.patron_image_url).toContain('patron');
    });

    const req = httpMock.expectOne(`${baseUrl}/upload-patron-image`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush({
      success: true,
      data: {
        patron_image_path: 'tenants/1/patron/patron.jpg',
        patron_image_url: '/storage/tenants/1/patron/patron.jpg',
      },
    });
  });

  it('deletes patron image', () => {
    service.deletePatronImage().subscribe((response) => {
      expect(response.success).toBe(true);
    });

    const req = httpMock.expectOne(`${baseUrl}/patron-image`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ success: true, data: null });
  });
});
