/**
 * Tenant Create Modal Component
 * Professional form with complete validation, API integration, and error handling
 */

import { Component, EventEmitter, Output, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { TenantService } from '@core/services/tenant.service';
import { ToastService } from '@core/services/toast.service';
import { CreateTenantRequest, TenantAddress } from '@core/models/tenant.model';
import { GeographyService, Country, State } from '@core/services/geography.service';
import { getTenantCallingCode } from '@core/validators/phone.validators';

interface FormErrors {
  [key: string]: string;
}

@Component({
  selector: 'app-tenant-create-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule],
  templateUrl: './tenant-create-modal.html',
  styleUrls: ['./tenant-create-modal.scss']
})
export class TenantCreateModalComponent implements OnInit {
  private tenantService = inject(TenantService);
  private toastService = inject(ToastService);
  private geographyService = inject(GeographyService);

  @Output() close = new EventEmitter<void>();
  @Output() tenantCreated = new EventEmitter<void>();

  constructor() {
    console.log('🎉 TenantCreateModalComponent initialized!');
  }

  /**
   * Initialize component - load countries
   */
  ngOnInit(): void {
    this.loadCountries();
  }

  /**
   * Load all countries for dropdowns
   */
  loadCountries(): void {
    this.loadingCountries = true;
    this.geographyService.getCountries().subscribe({
      next: (response) => {
        if (response.success) {
          this.countries = response.data;
          console.log(`✅ Loaded ${response.count} countries`);
        }
        this.loadingCountries = false;
      },
      error: (error) => {
        console.error('❌ Error loading countries:', error);
        this.toastService.error('Failed to load countries', 'Error');
        this.loadingCountries = false;
      }
    });
  }

  /**
   * Handle tenant country change - load states for selected country
   */
  onTenantCountryChange(countryId: number | null): void {
    this.formData.tenant_official_address.state_id = 0;
    this.tenantStates = [];
    
    if (!countryId || countryId === 0) return;
    
    this.loadingTenantStates = true;
    this.geographyService.getStatesByCountry(countryId).subscribe({
      next: (response) => {
        if (response.success) {
          this.tenantStates = response.data;
          console.log(`✅ Loaded ${response.count} states for tenant address`);
        }
        this.loadingTenantStates = false;
      },
      error: (error) => {
        console.error('❌ Error loading states:', error);
        this.toastService.error('Failed to load states/provinces', 'Error');
        this.loadingTenantStates = false;
      }
    });
  }

  /**
   * Handle primary user country change - load states for selected country
   */
  onPrimaryCountryChange(countryId: number | null): void {
    this.formData.primary_user_address.state_id = 0;
    this.primaryStates = [];
    
    if (!countryId || countryId === 0) return;
    
    this.loadingPrimaryStates = true;
    this.geographyService.getStatesByCountry(countryId).subscribe({
      next: (response) => {
        if (response.success) {
          this.primaryStates = response.data;
          console.log(`✅ Loaded ${response.count} states for primary user address`);
        }
        this.loadingPrimaryStates = false;
      },
      error: (error) => {
        console.error('❌ Error loading states:', error);
        this.toastService.error('Failed to load states/provinces', 'Error');
        this.loadingPrimaryStates = false;
      }
    });
  }

  // Geographic data for dropdowns
  countries: Country[] = [];
  tenantStates: State[] = [];
  primaryStates: State[] = [];

  // Loading states
  loadingCountries = false;
  loadingTenantStates = false;
  loadingPrimaryStates = false;

  // Form data
  formData: CreateTenantRequest = {
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
    primary_user_email: '',
    primary_contact_number: '',
    primary_user_address: {
      line1: '',
      line2: '',
      country_id: 0,
      state_id: 0,
      district: '',
      pin_zip_code: ''
    }
  };

  // State management
  isSubmitting = false;
  sameAsTenantAddress = false;
  logoPreviewUrl: string | null = null;
  logoFileName: string = '';
  formErrors: FormErrors = {};
  serverError: string = '';
  successMessage: string = '';
  callingCode: string = getTenantCallingCode();

  // Validation flags
  touched: { [key: string]: boolean } = {};

  /**
   * Close modal
   */
  onClose(): void {
    if (!this.isSubmitting) {
      this.close.emit();
    }
  }

  /**
   * Handle "Same as Tenant Address" checkbox change
   */
  onSameAsTenantAddressChange(): void {
    if (this.sameAsTenantAddress) {
      // Copy tenant official address to primary user address
      this.formData.primary_user_address = {
        line1: this.formData.tenant_official_address.line1,
        line2: this.formData.tenant_official_address.line2,
        country_id: this.formData.tenant_official_address.country_id,
        state_id: this.formData.tenant_official_address.state_id,
        district: this.formData.tenant_official_address.district,
        pin_zip_code: this.formData.tenant_official_address.pin_zip_code
      };
      // Also copy the states array
      this.primaryStates = [...this.tenantStates];
    } else {
      // Clear primary user address when unchecked
      this.formData.primary_user_address = {
        line1: '',
        line2: '',
        country_id: 0,
        state_id: 0,
        district: '',
        pin_zip_code: ''
      };
      this.primaryStates = [];
    }
  }

  /**
   * Mark field as touched
   */
  markAsTouched(field: string): void {
    this.touched[field] = true;
  }

  /**
   * Check if field is invalid
   */
  isFieldInvalid(field: string): boolean {
    return this.touched[field] && !!this.getFieldError(field);
  }

  /**
   * Get field error message
   */
  getFieldError(field: string): string {
    return this.formErrors[field] || '';
  }

  /**
   * Validate entire form
   */
  validateForm(): boolean {
    this.formErrors = {};
    let isValid = true;

    // Tenant name
    if (!this.formData.tenant_name?.trim()) {
      this.formErrors['tenant_name'] = 'Tenant name is required';
      isValid = false;
    }

    // Tenant official address validation
    if (!this.formData.tenant_official_address.line1?.trim()) {
      this.formErrors['tenant_official_address.line1'] = 'Tenant address line 1 is required';
      isValid = false;
    }
    if (!this.formData.tenant_official_address.country_id || this.formData.tenant_official_address.country_id === 0) {
      this.formErrors['tenant_official_address.country_id'] = 'Tenant country is required';
      isValid = false;
    }
    if (!this.formData.tenant_official_address.state_id || this.formData.tenant_official_address.state_id === 0) {
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

    // Primary user name
    if (!this.formData.primary_user_name?.trim()) {
      this.formErrors['primary_user_name'] = 'Primary user name is required';
      isValid = false;
    }

    // Primary user email
    if (!this.formData.primary_user_email?.trim()) {
      this.formErrors['primary_user_email'] = 'Primary user email is required';
      isValid = false;
    } else if (!this.isValidEmail(this.formData.primary_user_email)) {
      this.formErrors['primary_user_email'] = 'Please enter a valid email address';
      isValid = false;
    }

    // Primary contact number
    if (!this.formData.primary_contact_number?.trim()) {
      this.formErrors['primary_contact_number'] = 'Primary contact number is required';
      isValid = false;
    }

    // Primary user address validation
    if (!this.formData.primary_user_address.line1?.trim()) {
      this.formErrors['primary_user_address.line1'] = 'Address line 1 is required';
      isValid = false;
    }
    if (!this.formData.primary_user_address.country_id || this.formData.primary_user_address.country_id === 0) {
      this.formErrors['primary_user_address.country_id'] = 'Country is required';
      isValid = false;
    }
    if (!this.formData.primary_user_address.state_id || this.formData.primary_user_address.state_id === 0) {
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

  /**
   * Check if form is valid
   */
  isFormValid(): boolean {
    return this.validateForm();
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Submit form
   */
  onSubmit(): void {
    console.log('🔵 onSubmit() called!');
    console.log('Form data:', this.formData);
    
    // Mark all fields as touched
    Object.keys(this.formData).forEach(key => {
      this.touched[key] = true;
    });
    Object.keys(this.formData.primary_user_address).forEach(key => {
      this.touched[`primary_user_address.${key}`] = true;
    });

    // Validate form
    console.log('🔍 Validating form...');
    const isValid = this.validateForm();
    console.log('Form validation result:', isValid);
    console.log('Form errors:', this.formErrors);
    
    if (!isValid) {
      console.log('❌ Validation failed!');
      this.serverError = 'Please fix the validation errors before submitting';
      return;
    }

    console.log('✅ Validation passed! Preparing API call...');
    
    // Clear previous errors
    this.serverError = '';
    this.successMessage = '';
    this.isSubmitting = true;

    // Prepare request data
    const requestData: CreateTenantRequest = {
      tenant_name: this.formData.tenant_name.trim(),
      tenant_official_address: this.formData.tenant_official_address,
      primary_user_name: this.formData.primary_user_name.trim(),
      primary_user_email: this.formData.primary_user_email.trim(),
      primary_contact_number: this.formData.primary_contact_number.trim(),
      primary_user_address: this.formData.primary_user_address,
      tenant_logo: this.formData.tenant_logo
    };

    // Add optional slogan if provided
    if (this.formData.slogan?.trim()) {
      requestData.slogan = this.formData.slogan.trim();
    }

    // Call API
    this.tenantService.createTenant(requestData).subscribe({
      next: (response) => {
        console.log('Tenant creation response:', response);
        this.isSubmitting = false;
        
        if (response.success) {
          // Show success toast
          console.log('Showing success toast');
          this.toastService.success(
            response.message || 'Tenant created successfully!',
            'Success',
            5000
          );
          
          // Close modal after a brief delay to see the toast
          setTimeout(() => {
            this.tenantCreated.emit();
            this.resetForm();
            this.close.emit();
          }, 500);
        }
      },
      error: (error) => {
        console.error('Tenant creation error:', error);
        this.isSubmitting = false;
        
        // Show error toast
        this.toastService.error(
          error.message || 'Failed to create tenant. Please try again.',
          'Error',
          6000
        );
        
        // Also set inline error for visibility in modal
        this.serverError = error.message || 'Failed to create tenant. Please try again.';
        
        // Scroll to top to show error
        const modalBody = document.querySelector('.modal-body');
        if (modalBody) {
          modalBody.scrollTop = 0;
        }
      }
    });
  }

  /**
   * Handle logo file selection
   */
  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        this.formErrors['tenant_logo'] = 'Please select a valid image file (JPEG, PNG, GIF, or WebP)';
        input.value = '';
        return;
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        this.formErrors['tenant_logo'] = 'File size must be less than 5MB';
        input.value = '';
        return;
      }

      // Clear any previous logo errors
      delete this.formErrors['tenant_logo'];

      this.formData.tenant_logo = file;
      this.logoFileName = file.name;

      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        this.logoPreviewUrl = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  /**
   * Remove logo
   */
  removeLogo(): void {
    this.formData.tenant_logo = undefined;
    this.logoPreviewUrl = null;
    this.logoFileName = '';
    delete this.formErrors['tenant_logo'];
    
    // Clear file input
    const fileInput = document.getElementById('tenantLogo') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  /**
   * Trigger file input click
   */
  triggerFileInput(): void {
    if (!this.isSubmitting) {
      const fileInput = document.getElementById('tenantLogo') as HTMLInputElement;
      fileInput?.click();
    }
  }

  /**
   * Reset form to initial state
   */
  resetForm(): void {
    this.formData = {
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
      primary_user_email: '',
      primary_contact_number: '',
      primary_user_address: {
        line1: '',
        line2: '',
        country_id: 0,
        state_id: 0,
        district: '',
        pin_zip_code: ''
      }
    };
    this.tenantStates = [];
    this.primaryStates = [];
    this.sameAsTenantAddress = false;
    this.logoPreviewUrl = null;
    this.logoFileName = '';
    this.formErrors = {};
    this.serverError = '';
    this.successMessage = '';
    this.touched = {};
    this.isSubmitting = false;
  }

  /**
   * Handle backdrop click
   */
  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget && !this.isSubmitting) {
      this.onClose();
    }
  }
}
