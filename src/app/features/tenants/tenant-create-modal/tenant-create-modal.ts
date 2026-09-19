/**
 * Tenant Create Modal Component
 * Professional form with complete validation, API integration, and error handling
 */

import { Component, EventEmitter, Output, inject, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { TenantService } from '@core/services/tenant.service';
import { ToastService } from '@core/services/toast.service';
import { CreateTenantRequest, TenantAddress } from '@core/models/tenant.model';
import { GeographyService, Country, State } from '@core/services/geography.service';
import { ArchdioceseService } from '@core/services/church/archdiocese.service';
import { Archdiocese } from '@core/models/church';
import { PhoneCodeService } from '@core/services/phone-code.service';
import { PhoneInputComponent } from '@shared/components/phone-input/phone-input.component';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface FormErrors {
  [key: string]: string;
}

const EMPTY_ADDRESS: TenantAddress = {
  line1: '',
  line2: '',
  country_id: null,
  state_id: null,
  district: '',
  pin_zip_code: ''
};

const PHONE_MIN_DIGITS = 6;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;

@Component({
  selector: 'app-tenant-create-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule, PhoneInputComponent, ModalShellComponent],
  templateUrl: './tenant-create-modal.html',
  styleUrls: ['./tenant-create-modal.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TenantCreateModalComponent implements OnInit, OnDestroy {
  private tenantService = inject(TenantService);
  private toastService = inject(ToastService);
  private geographyService = inject(GeographyService);
  private archdioceseService = inject(ArchdioceseService);
  private phoneCodeService = inject(PhoneCodeService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  @Output() close = new EventEmitter<void>();
  @Output() tenantCreated = new EventEmitter<void>();

  ngOnInit(): void {
    this.loadCountries();
    this.loadArchdioceses();
  }

  loadArchdioceses(): void {
    this.loadingArchdioceses = true;
    this.archdiocesesLoadError = '';
    this.cdr.markForCheck();

    this.archdioceseService.getArchdioceses()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const rows = Array.isArray(response.data) ? response.data : [];
          if (response.success && rows.length > 0) {
            this.archdioceseOptions = [...rows].sort((a, b) => a.name.localeCompare(b.name));
            this.archdioceses = this.archdioceseOptions;
          } else if (response.success) {
            this.archdioceseOptions = [];
            this.archdioceses = [];
            this.archdiocesesLoadError = 'No dioceses are configured in the system.';
          } else {
            this.archdioceseOptions = null;
            this.archdioceses = [];
            this.archdiocesesLoadError = response.message || 'Failed to load dioceses';
          }
          this.loadingArchdioceses = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.archdioceseOptions = null;
          this.archdioceses = [];
          this.archdiocesesLoadError = 'Failed to load dioceses. Check your connection and try again.';
          this.loadingArchdioceses = false;
          this.cdr.markForCheck();
        }
      });
  }

  loadCountries(): void {
    this.loadingCountries = true;
    this.countriesLoadError = '';
    this.cdr.markForCheck();
    this.geographyService.getCountries({ refresh: true })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const rows = Array.isArray(response.data) ? response.data : [];

          if (response.success && rows.length > 0) {
            const sorted = this.sortCountries(rows);
            this.countryOptions = sorted;
            this.countries = sorted;

            const primaryCountryId = this.formData.primary_user_address.country_id;
            if (primaryCountryId) {
              this.updateCallingCodeSafely(primaryCountryId);
            }
          } else if (response.success && rows.length === 0) {
            this.countryOptions = null;
            this.countries = [];
            this.countriesLoadError =
              'No countries are configured in the system. Ask an administrator to seed geographic data.';
            this.toastService.error(this.countriesLoadError, 'Countries unavailable');
          } else {
            this.countryOptions = null;
            this.countries = [];
            this.countriesLoadError = response.message || 'Failed to load countries';
            this.toastService.error(this.countriesLoadError, 'Error');
          }
          this.loadingCountries = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.countryOptions = null;
          this.countries = [];
          this.countriesLoadError = 'Failed to load countries. Check your connection and try again.';
          this.toastService.error(this.countriesLoadError, 'Error');
          this.loadingCountries = false;
          this.cdr.markForCheck();
        }
      });
  }

  onTenantCountryChange(countryId: number | null): void {
    this.formData.tenant_official_address.state_id = null;
    this.tenantStates = [];
    this.tenantStateOptions = null;
    this.primaryStateOptions = this.sameAsTenantAddress ? null : this.primaryStateOptions;

    if (!countryId) {
      if (this.sameAsTenantAddress) {
        this.syncPrimaryFromTenant();
      }
      this.cdr.markForCheck();
      return;
    }

    const shouldUpdatePhoneCode =
      !this.formData.primary_user_address.country_id || this.sameAsTenantAddress;

    if (shouldUpdatePhoneCode) {
      this.updateCallingCodeSafely(countryId);
    }

    if (this.sameAsTenantAddress) {
      this.syncPrimaryFromTenant();
    }

    this.loadStatesForCountry(countryId, 'tenant');
  }

  onPrimaryCountryChange(countryId: number | null): void {
    if (this.sameAsTenantAddress) {
      return;
    }

    this.formData.primary_user_address.state_id = null;
    this.primaryStates = [];
    this.primaryStateOptions = null;

    if (!countryId) {
      this.phoneCodeService.resetToDefault();
      this.cdr.markForCheck();
      return;
    }

    this.updateCallingCodeSafely(countryId);
    this.loadStatesForCountry(countryId, 'primary');
  }

  onTenantAddressFieldChange(): void {
    if (this.sameAsTenantAddress) {
      this.syncPrimaryFromTenant();
    }
  }

  private loadStatesForCountry(countryId: number, target: 'tenant' | 'primary'): void {
    const loadingKey = target === 'tenant' ? 'loadingTenantStates' : 'loadingPrimaryStates';
    this[loadingKey] = true;
    this.cdr.markForCheck();

    this.geographyService.getStatesByCountry(countryId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const rows = Array.isArray(response.data) ? response.data : [];
          if (response.success) {
            if (target === 'tenant') {
              this.tenantStateOptions = rows;
              this.tenantStates = rows;
              if (this.sameAsTenantAddress) {
                this.primaryStateOptions = [...rows];
                this.primaryStates = [...rows];
              }
            } else {
              this.primaryStateOptions = rows;
              this.primaryStates = rows;
            }
          } else {
            if (target === 'tenant') {
              this.tenantStateOptions = [];
              this.tenantStates = [];
            } else {
              this.primaryStateOptions = [];
              this.primaryStates = [];
            }
          }
          this[loadingKey] = false;
          this.cdr.markForCheck();
        },
        error: () => {
          if (target === 'tenant') {
            this.tenantStateOptions = [];
            this.tenantStates = [];
          } else {
            this.primaryStateOptions = [];
            this.primaryStates = [];
          }
          this.toastService.error('Failed to load states/provinces', 'Error');
          this[loadingKey] = false;
          this.cdr.markForCheck();
        }
      });
  }

  private updateCallingCodeSafely(countryId: number): void {
    this.phoneCodeService.updatePhoneCodeByCountryId(countryId, this.countries)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.cdr.markForCheck(),
        error: () => this.cdr.markForCheck()
      });
  }

  private sortCountries(countries: Country[]): Country[] {
    return [...countries].sort((a, b) => {
      const aName = a.name ?? '';
      const bName = b.name ?? '';
      const aIsIndia = aName.toLowerCase().includes('india') || a.iso2 === 'IN';
      const bIsIndia = bName.toLowerCase().includes('india') || b.iso2 === 'IN';
      if (aIsIndia && !bIsIndia) return -1;
      if (!aIsIndia && bIsIndia) return 1;
      return aName.localeCompare(bName);
    });
  }

  private syncPrimaryFromTenant(): void {
    this.formData.primary_user_address = {
      line1: this.formData.tenant_official_address.line1,
      line2: this.formData.tenant_official_address.line2,
      country_id: this.formData.tenant_official_address.country_id,
      state_id: this.formData.tenant_official_address.state_id,
      district: this.formData.tenant_official_address.district,
      pin_zip_code: this.formData.tenant_official_address.pin_zip_code
    };
    this.primaryStates = [...this.tenantStates];
    this.primaryStateOptions = this.tenantStateOptions ? [...this.tenantStateOptions] : null;

    const countryId = this.formData.tenant_official_address.country_id;
    if (countryId) {
      this.updateCallingCodeSafely(countryId);
    }
    this.cdr.markForCheck();
  }

  countries: Country[] = [];
  /** Set only after a successful fetch so ng-select mounts with a populated items list. */
  countryOptions: Country[] | null = null;
  tenantStates: State[] = [];
  /** Populated after states load for the selected tenant country (ng-select mount gate). */
  tenantStateOptions: State[] | null = null;
  primaryStates: State[] = [];
  /** Populated after states load for the selected primary country (ng-select mount gate). */
  primaryStateOptions: State[] | null = null;

  loadingCountries = false;
  countriesLoadError = '';
  loadingTenantStates = false;
  loadingPrimaryStates = false;
  archdioceses: Archdiocese[] = [];
  archdioceseOptions: Archdiocese[] | null = null;
  loadingArchdioceses = false;
  archdiocesesLoadError = '';

  formData: CreateTenantRequest = {
    tenant_name: '',
    slogan: '',
    domain: '',
    archdiocese_id: null,
    tenant_official_address: { ...EMPTY_ADDRESS },
    primary_user_name: '',
    primary_user_email: '',
    primary_user_password: '',
    primary_user_password_confirmation: '',
    primary_contact_number: '',
    primary_user_address: { ...EMPTY_ADDRESS }
  };

  isSubmitting = false;
  sameAsTenantAddress = false;
  logoPreviewUrl: string | null = null;
  logoFileName = '';
  formErrors: FormErrors = {};
  serverError = '';
  successMessage = '';
  touched: { [key: string]: boolean } = {};

  readonly appendToBody = 'body';

  onClose(): void {
    if (!this.isSubmitting) {
      this.close.emit();
    }
  }

  onSameAsTenantAddressChange(): void {
    if (this.sameAsTenantAddress) {
      this.syncPrimaryFromTenant();
    } else {
      this.cdr.markForCheck();
    }
  }

  markAsTouched(field: string): void {
    this.touched[field] = true;
  }

  isFieldInvalid(field: string): boolean {
    return this.touched[field] && !!this.getFieldError(field);
  }

  getFieldError(field: string): string {
    return this.formErrors[field] || '';
  }

  get countryPlaceholder(): string {
    if (this.loadingCountries) {
      return 'Loading countries…';
    }
    return this.countries.length ? 'Select country' : 'No countries available';
  }

  private markAllFieldsTouched(): void {
    this.touched['tenant_name'] = true;
    this.touched['primary_user_name'] = true;
    this.touched['primary_user_email'] = true;
    this.touched['primary_user_password'] = true;
    this.touched['primary_user_password_confirmation'] = true;
    this.touched['primary_contact_number'] = true;
    this.touched['domain'] = true;
    this.touched['archdiocese_id'] = true;

    Object.keys(this.formData.tenant_official_address).forEach(key => {
      this.touched[`tenant_official_address.${key}`] = true;
    });
    Object.keys(this.formData.primary_user_address).forEach(key => {
      this.touched[`primary_user_address.${key}`] = true;
    });
  }

  validateForm(): boolean {
    this.formErrors = {};
    let isValid = true;

    const name = this.formData.tenant_name?.trim() ?? '';
    if (!name) {
      this.formErrors['tenant_name'] = 'Tenant name is required';
      isValid = false;
    } else if (name.length > 255) {
      this.formErrors['tenant_name'] = 'Tenant name must not exceed 255 characters';
      isValid = false;
    }

    const domain = this.formData.domain?.trim() ?? '';
    if (domain && domain.length > 255) {
      this.formErrors['domain'] = 'Domain must not exceed 255 characters';
      isValid = false;
    } else if (domain && !/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(domain)) {
      this.formErrors['domain'] = 'Enter a valid domain (e.g. sacredheart.example.org)';
      isValid = false;
    }

    if (!this.formData.tenant_official_address.line1?.trim()) {
      this.formErrors['tenant_official_address.line1'] = 'Tenant address line 1 is required';
      isValid = false;
    }
    if (!this.formData.tenant_official_address.country_id) {
      this.formErrors['tenant_official_address.country_id'] = 'Tenant country is required';
      isValid = false;
    }
    if (!this.formData.tenant_official_address.state_id) {
      this.formErrors['tenant_official_address.state_id'] = 'Tenant state/province is required';
      isValid = false;
    }
    if (!this.formData.tenant_official_address.district?.trim()) {
      this.formErrors['tenant_official_address.district'] = 'Tenant district/city is required';
      isValid = false;
    }
    if (!this.formData.tenant_official_address.pin_zip_code?.trim()) {
      this.formErrors['tenant_official_address.pin_zip_code'] = 'Tenant PIN/ZIP code is required';
      isValid = false;
    }

    if (!this.formData.primary_user_name?.trim()) {
      this.formErrors['primary_user_name'] = 'Primary user name is required';
      isValid = false;
    }

    if (!this.formData.primary_user_email?.trim()) {
      this.formErrors['primary_user_email'] = 'Primary user email is required';
      isValid = false;
    } else if (!this.isValidEmail(this.formData.primary_user_email)) {
      this.formErrors['primary_user_email'] = 'Please enter a valid email address';
      isValid = false;
    }

    const password = this.formData.primary_user_password ?? '';
    if (!password.trim()) {
      this.formErrors['primary_user_password'] = 'Password is required';
      isValid = false;
    } else if (password.length < PASSWORD_MIN_LENGTH) {
      this.formErrors['primary_user_password'] = `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
      isValid = false;
    } else if (!PASSWORD_PATTERN.test(password)) {
      this.formErrors['primary_user_password'] =
        'Password must contain uppercase, lowercase, number, and special character';
      isValid = false;
    }

    const passwordConfirmation = this.formData.primary_user_password_confirmation ?? '';
    if (!passwordConfirmation.trim()) {
      this.formErrors['primary_user_password_confirmation'] = 'Password confirmation is required';
      isValid = false;
    } else if (passwordConfirmation !== password) {
      this.formErrors['primary_user_password_confirmation'] = 'Passwords do not match';
      isValid = false;
    }

    const phoneDigits = (this.formData.primary_contact_number ?? '').replace(/\D/g, '');
    if (!phoneDigits) {
      this.formErrors['primary_contact_number'] = 'Primary contact number is required';
      isValid = false;
    } else if (phoneDigits.length < PHONE_MIN_DIGITS) {
      this.formErrors['primary_contact_number'] = `Phone number must be at least ${PHONE_MIN_DIGITS} digits`;
      isValid = false;
    }

    if (!this.formData.primary_user_address.line1?.trim()) {
      this.formErrors['primary_user_address.line1'] = 'Address line 1 is required';
      isValid = false;
    }
    if (!this.formData.primary_user_address.country_id) {
      this.formErrors['primary_user_address.country_id'] = 'Country is required';
      isValid = false;
    }
    if (!this.formData.primary_user_address.state_id) {
      this.formErrors['primary_user_address.state_id'] = 'State/Province is required';
      isValid = false;
    }
    if (!this.formData.primary_user_address.district?.trim()) {
      this.formErrors['primary_user_address.district'] = 'District/City is required';
      isValid = false;
    }
    if (!this.formData.primary_user_address.pin_zip_code?.trim()) {
      this.formErrors['primary_user_address.pin_zip_code'] = 'PIN/ZIP code is required';
      isValid = false;
    }

    return isValid;
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  validatePasswordFields(): void {
    const password = this.formData.primary_user_password ?? '';
    const passwordConfirmation = this.formData.primary_user_password_confirmation ?? '';

    if (!password.trim()) {
      this.formErrors['primary_user_password'] = 'Password is required';
    } else if (password.length < PASSWORD_MIN_LENGTH) {
      this.formErrors['primary_user_password'] = `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
    } else if (!PASSWORD_PATTERN.test(password)) {
      this.formErrors['primary_user_password'] =
        'Password must contain uppercase, lowercase, number, and special character';
    } else {
      delete this.formErrors['primary_user_password'];
    }

    if (!passwordConfirmation.trim()) {
      this.formErrors['primary_user_password_confirmation'] = 'Password confirmation is required';
    } else if (passwordConfirmation !== password) {
      this.formErrors['primary_user_password_confirmation'] = 'Passwords do not match';
    } else {
      delete this.formErrors['primary_user_password_confirmation'];
    }

    this.cdr.markForCheck();
  }

  private mapServerValidationErrors(errors: Record<string, string[] | string> | undefined): void {
    if (!errors) {
      return;
    }

    const fieldMap: Record<string, string> = {
      tenant_name: 'tenant_name',
      'tenant_official_address.line1': 'tenant_official_address.line1',
      'tenant_official_address.country_id': 'tenant_official_address.country_id',
      'tenant_official_address.state_id': 'tenant_official_address.state_id',
      'tenant_official_address.district': 'tenant_official_address.district',
      'tenant_official_address.pin_zip_code': 'tenant_official_address.pin_zip_code',
      primary_user_name: 'primary_user_name',
      primary_user_email: 'primary_user_email',
      primary_user_password: 'primary_user_password',
      primary_user_password_confirmation: 'primary_user_password_confirmation',
      primary_contact_number: 'primary_contact_number',
      domain: 'domain',
      archdiocese_id: 'archdiocese_id',
      'primary_user_address.line1': 'primary_user_address.line1',
      'primary_user_address.country_id': 'primary_user_address.country_id',
      'primary_user_address.state_id': 'primary_user_address.state_id',
      'primary_user_address.district': 'primary_user_address.district',
      'primary_user_address.pin_zip_code': 'primary_user_address.pin_zip_code',
      tenant_logo: 'tenant_logo'
    };

    Object.entries(errors).forEach(([key, value]) => {
      const mapped = fieldMap[key] ?? key;
      const message = Array.isArray(value) ? value[0] : value;
      if (message) {
        this.formErrors[mapped] = message;
        this.touched[mapped] = true;
      }
    });
  }

  onCreateButtonClick(_event: Event): void {
    // Intentionally empty — submit handled by form ngSubmit.
  }

  onSubmit(): void {
    this.markAllFieldsTouched();

    const isValid = this.validateForm();
    if (!isValid) {
      this.serverError = 'Please fix the validation errors before submitting';
      this.cdr.markForCheck();
      return;
    }

    this.serverError = '';
    this.successMessage = '';
    this.isSubmitting = true;
    this.cdr.markForCheck();

    const requestData: CreateTenantRequest = {
      tenant_name: this.formData.tenant_name.trim(),
      tenant_official_address: {
        ...this.formData.tenant_official_address,
        country_id: this.formData.tenant_official_address.country_id!,
        state_id: this.formData.tenant_official_address.state_id!
      },
      primary_user_name: this.formData.primary_user_name.trim(),
      primary_user_email: this.formData.primary_user_email.trim(),
      primary_user_password: this.formData.primary_user_password,
      primary_user_password_confirmation: this.formData.primary_user_password_confirmation,
      primary_contact_number: this.formData.primary_contact_number.trim(),
      primary_user_address: {
        ...this.formData.primary_user_address,
        country_id: this.formData.primary_user_address.country_id!,
        state_id: this.formData.primary_user_address.state_id!
      },
      tenant_logo: this.formData.tenant_logo
    };

    if (this.formData.slogan?.trim()) {
      requestData.slogan = this.formData.slogan.trim();
    }

    if (this.formData.domain?.trim()) {
      requestData.domain = this.formData.domain.trim();
    }

    if (this.formData.archdiocese_id) {
      requestData.archdiocese_id = this.formData.archdiocese_id;
    }

    this.tenantService.createTenant(requestData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.isSubmitting = false;

          if (response.success) {
            this.toastService.success(
              response.message || 'Tenant created successfully!',
              'Success',
              5000
            );
            setTimeout(() => {
              this.tenantCreated.emit();
              this.resetForm();
              this.close.emit();
            }, 500);
          } else {
            const message = response.message || 'Failed to create tenant. Please try again.';
            this.serverError = message;
            this.toastService.error(message, 'Error', 6000);
          }
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.isSubmitting = false;
          this.mapServerValidationErrors(error.errors);
          const message = error.message || 'Failed to create tenant. Please try again.';
          this.serverError = message;
          this.toastService.error(message, 'Error', 6000);
          this.cdr.markForCheck();
        }
      });
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) {
      return;
    }

    const file = input.files[0];
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      this.formErrors['tenant_logo'] = 'Please select a valid image file (JPEG, PNG, or WebP)';
      input.value = '';
      this.cdr.markForCheck();
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      this.formErrors['tenant_logo'] = 'File size must be less than 5MB';
      input.value = '';
      this.cdr.markForCheck();
      return;
    }

    delete this.formErrors['tenant_logo'];
    this.formData.tenant_logo = file;
    this.logoFileName = file.name;

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      this.logoPreviewUrl = e.target?.result as string;
      this.cdr.markForCheck();
    };
    reader.readAsDataURL(file);
  }

  removeLogo(): void {
    this.formData.tenant_logo = undefined;
    this.logoPreviewUrl = null;
    this.logoFileName = '';
    delete this.formErrors['tenant_logo'];

    const fileInput = document.getElementById('tenantLogo') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
    this.cdr.markForCheck();
  }

  resetForm(): void {
    this.formData = {
      tenant_name: '',
      slogan: '',
      domain: '',
      archdiocese_id: null,
      tenant_official_address: { ...EMPTY_ADDRESS },
      primary_user_name: '',
      primary_user_email: '',
      primary_user_password: '',
      primary_user_password_confirmation: '',
      primary_contact_number: '',
      primary_user_address: { ...EMPTY_ADDRESS }
    };
    this.tenantStates = [];
    this.tenantStateOptions = null;
    this.primaryStates = [];
    this.primaryStateOptions = null;
    this.sameAsTenantAddress = false;
    this.logoPreviewUrl = null;
    this.logoFileName = '';
    this.formErrors = {};
    this.serverError = '';
    this.successMessage = '';
    this.touched = {};
    this.isSubmitting = false;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
