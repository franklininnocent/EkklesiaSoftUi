import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PhoneCodeService } from './phone-code.service';
import { GeographyService } from './geography.service';
import { TenantService } from './tenant.service';
import { environment } from '@environments/environment';

describe('PhoneCodeService', () => {
  let service: PhoneCodeService;
  let tenantService: { getChurchProfile: jest.Mock };

  beforeEach(() => {
    tenantService = {
      getChurchProfile: jest.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        PhoneCodeService,
        {
          provide: GeographyService,
          useValue: {
            getCountries: jest.fn().mockReturnValue(of({
              success: true,
              data: [{ id: 1, name: 'India', iso2: 'IN', iso3: 'IND', phone_code: '+91' }],
              count: 1,
            })),
          },
        },
        { provide: TenantService, useValue: tenantService },
      ],
    });

    localStorage.clear();
    service = TestBed.inject(PhoneCodeService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('does not call church-profile for platform users without parish context', (done) => {
    localStorage.setItem(environment.userKey, JSON.stringify({ id: 1, tenant_id: null }));

    service.initializeFromApiOnce().subscribe((result) => {
      expect(tenantService.getChurchProfile).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      done();
    });
  });

  it('loads church-profile when user has tenant_id', (done) => {
    localStorage.setItem(environment.userKey, JSON.stringify({ id: 1, tenant_id: 10 }));
    tenantService.getChurchProfile.mockReturnValue(of({
      success: true,
      data: {
        addresses: [{ country_id: 1 }],
      },
    }));

    service.initializeFromApiOnce().subscribe((result) => {
      expect(tenantService.getChurchProfile).toHaveBeenCalled();
      expect(result.phoneCode).toBe('+91');
      done();
    });
  });

  it('falls back safely when church-profile is unavailable for tenant users', (done) => {
    localStorage.setItem(environment.userKey, JSON.stringify({ id: 1, tenant_id: 10 }));
    tenantService.getChurchProfile.mockReturnValue(throwError(() => ({ status: 404 })));

    service.initializeFromApiOnce().subscribe((result) => {
      expect(tenantService.getChurchProfile).toHaveBeenCalled();
      expect(result.success).toBe(true);
      done();
    });
  });
});
