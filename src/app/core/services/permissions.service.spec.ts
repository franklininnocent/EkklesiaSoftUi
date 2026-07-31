import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { PermissionsService } from './permissions.service';

describe('PermissionsService', () => {
  let service: PermissionsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PermissionsService]
    });

    service = TestBed.inject(PermissionsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('flattens grouped tenant permission payloads into response.data', () => {
    const groupedResponse = {
      success: true,
      data: [
        {
          module: 'Users',
          permissions: [
            {
              id: 1,
              name: 'users.view',
              display_name: 'View Users',
              module: 'Users',
              is_custom: false,
              active: 1,
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z'
            }
          ]
        },
        {
          module: 'Members',
          permissions: [
            {
              id: 2,
              name: 'members.view',
              display_name: 'View Members',
              is_custom: false,
              active: 1,
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z'
            }
          ]
        }
      ]
    };

    service.getPermissions({ per_page: 'all' }, { tenantMode: true }).subscribe((response: any) => {
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data).toHaveLength(2);
      expect(response.data[0].id).toBe(1);
      expect(response.data[1].id).toBe(2);
      expect(response.data[1].module).toBe('Members');
    });

    const request = httpMock.expectOne((req) =>
      req.method === 'GET'
      && req.url.endsWith('/tenant/permissions')
      && req.params.get('per_page') === 'all'
    );

    request.flush(groupedResponse);
  });
});
