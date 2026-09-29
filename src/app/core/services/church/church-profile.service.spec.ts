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
        patron_image_url: 'https://api.example.test/api/tenant/media/serve?token=patron-signed',
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

  it('loads authoritative church status metrics', () => {
    service.getStatusMetrics().subscribe((response) => {
      expect(response.success).toBe(true);
      expect(response.data?.membership_health.status).toBe('unavailable');
      expect(response.data?.profile_completeness.percent).toBe(45);
    });

    const req = httpMock.expectOne(`${baseUrl}/status-metrics`);
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: {
        membership_health: { key: 'membership_health', label: 'Membership Health', status: 'unavailable', percent: null, display: 'Not available', tooltip: 'Active members ratio' },
        sacramental_records: { key: 'sacramental_records', label: 'Sacramental Records', status: 'unavailable', percent: null, display: 'Not available', tooltip: 'Sacrament coverage' },
        volunteer_engagement: { key: 'volunteer_engagement', label: 'Volunteer Engagement', status: 'unavailable', percent: null, display: 'Not available', tooltip: 'Volunteer blend' },
        profile_completeness: { key: 'profile_completeness', label: 'Profile Completeness', status: 'available', percent: 45, display: '45%', tooltip: 'Profile fields' },
        generated_at: '2026-09-18T00:00:00+00:00',
      },
    });
  });
});
