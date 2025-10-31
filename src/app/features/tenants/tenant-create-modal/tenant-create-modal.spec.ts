import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TenantCreateModalComponent } from './tenant-create-modal';
import { TenantService } from '@core/services/tenant.service';
import { ToastService } from '@core/services/toast.service';
import { GeographyService } from '@core/services/geography.service';
import { of, throwError } from 'rxjs';

describe('TenantCreateModalComponent', () => {
  let component: TenantCreateModalComponent;
  let fixture: ComponentFixture<TenantCreateModalComponent>;

  beforeEach(async () => {
    const tenantService = {
      createTenant: jest.fn().mockReturnValue(of({ success: true, message: 'ok' }))
    } as unknown as TenantService;
    const toastService = { success: jest.fn(), error: jest.fn() } as unknown as ToastService;
    const geographyService = {
      getCountries: jest.fn().mockReturnValue(of({ success: true, data: [], count: 0 })),
      getStatesByCountry: jest.fn().mockReturnValue(of({ success: true, data: [], count: 0 }))
    } as unknown as GeographyService;

    await TestBed.configureTestingModule({
      imports: [TenantCreateModalComponent],
      providers: [
        { provide: TenantService, useValue: tenantService },
        { provide: ToastService, useValue: toastService },
        { provide: GeographyService, useValue: geographyService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TenantCreateModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('invalid by default with required errors', () => {
    const valid = component.validateForm();
    expect(valid).toBe(false);
    expect(component.getFieldError('tenant_name')).toBeTruthy();
    expect(component.getFieldError('tenant_official_address.country_id')).toBeTruthy();
    expect(component.getFieldError('primary_user_email')).toBeTruthy();
  });

  it('valid when required fields are provided correctly', () => {
    component.formData = {
      tenant_name: 'Acme Church',
      slogan: '',
      tenant_official_address: {
        line1: '123 Main',
        line2: '',
        country_id: 1,
        state_id: 10,
        district: 'Springfield',
        pin_zip_code: '12345'
      },
      primary_user_name: 'John Doe',
      primary_user_email: 'john@example.com',
      primary_contact_number: '5551234',
      primary_user_address: {
        line1: '123 Main',
        line2: '',
        country_id: 1,
        state_id: 10,
        district: 'Springfield',
        pin_zip_code: '12345'
      }
    } as any;

    const valid = component.validateForm();
    expect(valid).toBe(true);
  });

  it('onSubmit sets serverError when invalid', () => {
    component.formData = {
      tenant_name: '',
      slogan: '',
      tenant_official_address: {
        line1: '',
        line2: '',
        country_id: 0,
        state_id: 0,
        district: '',
        pin_zip_code: ''
      },
      primary_user_name: '',
      primary_user_email: 'bademail',
      primary_contact_number: '',
      primary_user_address: {
        line1: '',
        line2: '',
        country_id: 0,
        state_id: 0,
        district: '',
        pin_zip_code: ''
      }
    } as any;

    component.onSubmit();
    expect(component.serverError).toContain('Please fix the validation errors');
  });

  it('onSubmit calls service and clears serverError when valid', () => {
    component.formData = {
      tenant_name: 'Acme Church',
      slogan: '',
      tenant_official_address: {
        line1: '123 Main',
        line2: '',
        country_id: 1,
        state_id: 10,
        district: 'Springfield',
        pin_zip_code: '12345'
      },
      primary_user_name: 'John Doe',
      primary_user_email: 'john@example.com',
      primary_contact_number: '5551234',
      primary_user_address: {
        line1: '123 Main',
        line2: '',
        country_id: 1,
        state_id: 10,
        district: 'Springfield',
        pin_zip_code: '12345'
      }
    } as any;

    component.onSubmit();
    expect(component.serverError).toBe('');
  });

  it('sameAsTenantAddress copies address fields', () => {
    component.formData.tenant_official_address = {
      line1: 'A', line2: 'B', country_id: 1, state_id: 2, district: 'D', pin_zip_code: 'Z'
    } as any;
    component.sameAsTenantAddress = true;
    component.onSameAsTenantAddressChange();
    expect(component.formData.primary_user_address.line1).toBe('A');
    expect(component.formData.primary_user_address.country_id).toBe(1);
  });
});
