/**
 * Tenant Create Modal Component
 * Professional form with complete validation, API integration, and error handling
 */

import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TenantService } from '@core/services/tenant.service';
import { ToastService } from '@core/services/toast.service';
import { CreateTenantRequest, TenantAddress } from '@core/models/tenant.model';

interface FormErrors {
  [key: string]: string;
}

@Component({
  selector: 'app-tenant-create-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tenant-create-modal.html',
  styleUrls: ['./tenant-create-modal.scss']
})
export class TenantCreateModalComponent {
  private tenantService = inject(TenantService);
  private toastService = inject(ToastService);

  @Output() close = new EventEmitter<void>();
  @Output() tenantCreated = new EventEmitter<void>();

  // Form data
  formData: CreateTenantRequest = {
    tenant_name: '',
    primary_user_name: '',
    primary_user_email: '',
    primary_contact_number: '',
    secondary_user_name: '',
    secondary_user_email: '',
    secondary_contact_number: '',
    official_address: {
      line1: '',
      line2: '',
      district: '',
      state_province: '',
      country: '',
      pin_zip_code: ''
    },
    official_address2: {
      line1: '',
      line2: '',
      district: '',
      state_province: '',
      country: '',
      pin_zip_code: ''
    }
  };

  // State management
  isSubmitting = false;
  showAddress2 = false;
  logoPreviewUrl: string | null = null;
  logoFileName: string = '';
  formErrors: FormErrors = {};
  serverError: string = '';
  successMessage: string = '';

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
   * Toggle second address section
   */
  toggleAddress2(): void {
    this.showAddress2 = !this.showAddress2;
    if (!this.showAddress2) {
      // Clear address2 data when hiding
      this.formData.official_address2 = {
        line1: '',
        line2: '',
        district: '',
        state_province: '',
        country: '',
        pin_zip_code: ''
      };
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

    // Secondary email validation (if provided)
    if (this.formData.secondary_user_email?.trim() && !this.isValidEmail(this.formData.secondary_user_email)) {
      this.formErrors['secondary_user_email'] = 'Please enter a valid email address';
      isValid = false;
    }

    // Official address validation
    if (!this.formData.official_address.line1?.trim()) {
      this.formErrors['official_address.line1'] = 'Address line 1 is required';
      isValid = false;
    }
    if (!this.formData.official_address.district?.trim()) {
      this.formErrors['official_address.district'] = 'District is required';
      isValid = false;
    }
    if (!this.formData.official_address.state_province?.trim()) {
      this.formErrors['official_address.state_province'] = 'State/Province is required';
      isValid = false;
    }
    if (!this.formData.official_address.country?.trim()) {
      this.formErrors['official_address.country'] = 'Country is required';
      isValid = false;
    }
    if (!this.formData.official_address.pin_zip_code?.trim()) {
      this.formErrors['official_address.pin_zip_code'] = 'PIN/ZIP code is required';
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
    // Mark all fields as touched
    Object.keys(this.formData).forEach(key => {
      this.touched[key] = true;
    });
    Object.keys(this.formData.official_address).forEach(key => {
      this.touched[`official_address.${key}`] = true;
    });

    // Validate form
    if (!this.validateForm()) {
      this.serverError = 'Please fix the validation errors before submitting';
      return;
    }

    // Clear previous errors
    this.serverError = '';
    this.successMessage = '';
    this.isSubmitting = true;

    // Prepare request data
    const requestData: CreateTenantRequest = {
      tenant_name: this.formData.tenant_name.trim(),
      primary_user_name: this.formData.primary_user_name.trim(),
      primary_user_email: this.formData.primary_user_email.trim(),
      primary_contact_number: this.formData.primary_contact_number.trim(),
      official_address: this.formData.official_address,
      tenant_logo: this.formData.tenant_logo
    };

    // Add optional fields if provided
    if (this.formData.secondary_user_name?.trim()) {
      requestData.secondary_user_name = this.formData.secondary_user_name.trim();
    }
    if (this.formData.secondary_user_email?.trim()) {
      requestData.secondary_user_email = this.formData.secondary_user_email.trim();
    }
    if (this.formData.secondary_contact_number?.trim()) {
      requestData.secondary_contact_number = this.formData.secondary_contact_number.trim();
    }

    // Add second address if provided
    if (this.showAddress2 && this.formData.official_address2) {
      const addr2 = this.formData.official_address2;
      if (addr2.line1?.trim()) {
        requestData.official_address2 = addr2;
      }
    }

    // Call API
    this.tenantService.createTenant(requestData).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        if (response.success) {
          // Show success toast
          this.toastService.success(
            response.message || 'Tenant created successfully!',
            'Success',
            5000
          );
          
          // Close modal immediately and refresh list
          this.tenantCreated.emit();
          this.resetForm();
          this.close.emit();
        }
      },
      error: (error) => {
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
      primary_user_name: '',
      primary_user_email: '',
      primary_contact_number: '',
      secondary_user_name: '',
      secondary_user_email: '',
      secondary_contact_number: '',
      official_address: {
        line1: '',
        line2: '',
        district: '',
        state_province: '',
        country: '',
        pin_zip_code: ''
      },
      official_address2: {
        line1: '',
        line2: '',
        district: '',
        state_province: '',
        country: '',
        pin_zip_code: ''
      }
    };
    this.showAddress2 = false;
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
