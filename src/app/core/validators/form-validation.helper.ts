import { FormGroup, AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * Field label mapping for user-friendly error messages
 */
const FIELD_LABELS: { [key: string]: string } = {
  // Common fields
  'name': 'Name',
  'full_name': 'Full name',
  'first_name': 'First name',
  'last_name': 'Last name',
  'middle_name': 'Middle name',
  'email': 'Email address',
  'phone': 'Phone number',
  'contact_number': 'Contact number',
  'password': 'Password',
  'password_confirmation': 'Password confirmation',
  'confirm_password': 'Confirm password',
  
  // User fields
  'user_type': 'User type',
  'role_ids': 'Roles',
  'active': 'Active status',
  
  // Family fields
  'family_name': 'Family name',
  'family_code': 'Family code',
  'head_of_family': 'Head of family',
  'address_line_1': 'Address line 1',
  'address_line_2': 'Address line 2',
  'city': 'City',
  'state_id': 'State',
  'country_id': 'Country',
  'postal_code': 'Postal code',
  'primary_phone': 'Primary phone',
  'secondary_phone': 'Secondary phone',
  'bcc_id': 'BCC',
  'status': 'Status',
  
  // Family member fields
  'date_of_birth': 'Date of birth',
  'gender': 'Gender',
  'relationship_to_head': 'Relationship to head',
  'marital_status': 'Marital status',
  'occupation': 'Occupation',
  'education': 'Education',
  'baptism_date': 'Baptism date',
  'first_communion_date': 'First communion date',
  'confirmation_date': 'Confirmation date',
  
  // Tenant fields
  'tenant_name': 'Tenant name',
  'tenant_code': 'Tenant code',
  'domain': 'Domain',
  'contact_email': 'Contact email',
  'contact_phone': 'Contact phone',
  
  // BCC fields
  'bcc_code': 'BCC code',
  'bcc_name': 'BCC name',
  'meeting_place': 'Meeting place',
  'meeting_day': 'Meeting day',
  'meeting_time': 'Meeting time',
  
  // Role fields
  'role_name': 'Role name',
  'description': 'Description',
  'level': 'Level',
  'permission_ids': 'Permissions',
  
  // Bishop fields
  'ecclesiastical_title_id': 'Ecclesiastical title',
  'date_of_ordination': 'Date of ordination',
  'date_of_appointment': 'Date of appointment',
  'religious_order_id': 'Religious order',
  
  // Diocese fields
  'diocese_name': 'Diocese name',
  'diocese_code': 'Diocese code',
  'archdiocese_id': 'Archdiocese',
  
  // Sacrament fields
  'sacrament_type_id': 'Sacrament type',
  'celebration_date': 'Celebration date',
  'celebration_place': 'Celebration place',
};

/**
 * Get user-friendly error message for a form control
 * @param controlName The name of the form control
 * @param form The FormGroup containing the control
 * @returns User-friendly error message or empty string
 */
export function getErrorMessage(controlName: string, form: FormGroup): string {
  const control = form.get(controlName);
  if (!control || !control.errors || !control.touched) {
    return '';
  }

  const errors = control.errors;
  const fieldLabel = getFieldLabel(controlName);
  
  // Required validation
  if (errors['required']) {
    return `${fieldLabel} is required`;
  }
  
  // Email validation
  if (errors['email']) {
    return 'Email address is not in the correct format (e.g., name@example.com)';
  }
  
  // Phone validation errors
  if (errors['phoneInvalid']) {
    return 'Phone number is not in the correct format for your country';
  }
  
  if (errors['phoneDialCode']) {
    return `Phone number must start with ${errors['phoneDialCode'].requiredDialCode}`;
  }
  
  if (errors['phoneDigits'] || errors['phoneLocal']) {
    return 'Phone number must contain 6 to 12 digits';
  }
  
  // Pattern validation
  if (errors['pattern']) {
    return `${fieldLabel} contains invalid characters or format`;
  }
  
  // Min length validation
  if (errors['minlength']) {
    const requiredLength = errors['minlength'].requiredLength;
    const actualLength = errors['minlength'].actualLength;
    return `${fieldLabel} must be at least ${requiredLength} characters (currently ${actualLength})`;
  }
  
  // Max length validation
  if (errors['maxlength']) {
    const requiredLength = errors['maxlength'].requiredLength;
    const actualLength = errors['maxlength'].actualLength;
    return `${fieldLabel} cannot exceed ${requiredLength} characters (currently ${actualLength})`;
  }
  
  // Min value validation
  if (errors['min']) {
    return `${fieldLabel} must be at least ${errors['min'].min}`;
  }
  
  // Max value validation
  if (errors['max']) {
    return `${fieldLabel} cannot exceed ${errors['max'].max}`;
  }
  
  // Unique validation
  if (errors['unique']) {
    return `${fieldLabel} is already in use. Please choose a different value`;
  }
  
  // Custom validators
  if (errors['invalidDate']) {
    return `${fieldLabel} is not a valid date`;
  }
  
  if (errors['futureDate']) {
    return `${fieldLabel} cannot be a future date`;
  }
  
  if (errors['passwordMismatch']) {
    return 'Password confirmation does not match';
  }
  
  if (errors['weakPassword']) {
    return 'Password must contain uppercase, lowercase, number, and special character';
  }
  
  // Array validation
  if (errors['array']) {
    return `${fieldLabel} must be a list`;
  }
  
  if (errors['minArray']) {
    return `Please select at least ${errors['minArray'].min} ${fieldLabel.toLowerCase()}`;
  }
  
  // Generic fallback
  return `${fieldLabel} is invalid`;
}

/**
 * Get human-readable field label
 */
export function getFieldLabel(controlName: string): string {
  return FIELD_LABELS[controlName] || controlName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Check if a form control is invalid and has been touched
 */
export function isFieldInvalid(controlName: string, form: FormGroup): boolean {
  const control = form.get(controlName);
  return !!(control && control.invalid && control.touched);
}

/**
 * Mark all form controls as touched and focus on first invalid field
 */
export function markFormGroupTouched(form: FormGroup, fieldSelectorPrefix: string = ''): string | null {
  Object.keys(form.controls).forEach(key => {
    const control = form.get(key);
    if (control) {
      control.markAsTouched();
      control.updateValueAndValidity();
    }
  });
  
  // Find first invalid field
  const firstInvalidField = Object.keys(form.controls).find(key => {
    const control = form.get(key);
    return control && control.invalid;
  });
  
  if (firstInvalidField) {
    // Focus on first invalid field
    setTimeout(() => {
      const selector = fieldSelectorPrefix 
        ? `${fieldSelectorPrefix}[formControlName="${firstInvalidField}"]`
        : `[formControlName="${firstInvalidField}"]`;
      const element = document.querySelector(selector) as HTMLElement;
      if (element) {
        element.focus();
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
    
    return firstInvalidField;
  }
  
  return null;
}

