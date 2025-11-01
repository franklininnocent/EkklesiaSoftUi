import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { tenantPhoneValidator, getTenantCallingCode } from '../../../../core/validators/phone.validators';

export interface FamilyMemberFormValue {
  id?: number | null;
  first_name: string;
  middle_name?: string;
  last_name: string;
  date_of_birth?: string;
  gender?: string;
  relationship_to_head: string;
  marital_status?: string;
  phone?: string;
  email?: string;
  occupation?: string;
  education?: string;
  baptism_date?: string;
  first_communion_date?: string;
  confirmation_date?: string;
  status?: string;
}

@Component({
  selector: 'app-family-member-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './family-member-form-modal.component.html',
  styleUrls: ['./family-member-form-modal.component.scss']
})
export class FamilyMemberFormModalComponent implements OnChanges {
  @Input() member: FamilyMemberFormValue | null = null;
  @Output() save = new EventEmitter<FamilyMemberFormValue>();
  @Output() cancel = new EventEmitter<void>();

  form: FormGroup;
  saving = false;
  isEditMode = false;
  callingCode: string = getTenantCallingCode();
  errorMessage: string | null = null;

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      id: [null],
      first_name: ['', Validators.required],
      middle_name: [''],
      last_name: ['', Validators.required],
      date_of_birth: [''],
      gender: [''],
      relationship_to_head: ['other', Validators.required],
      marital_status: ['single'],
      phone: ['', tenantPhoneValidator()],
      email: ['', Validators.email],
      occupation: [''],
      education: [''],
      baptism_date: [''],
      first_communion_date: [''],
      confirmation_date: [''],
      status: ['active']
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Only patch form when member input FIRST changes, not on every change detection
    // This prevents overwriting user's form changes
    if (changes['member'] && changes['member'].firstChange && this.member) {
      this.isEditMode = true;
      this.errorMessage = null;
      // Prepare member data for form - handle date formats and normalize values
      const memberData: any = { ...this.member };
      
      // Normalize status to lowercase to ensure it matches select option values
      if (memberData.status) {
        memberData.status = String(memberData.status).toLowerCase().trim();
      } else {
        memberData.status = 'active'; // Default if not set
      }
      
      // Normalize other enum-like fields
      if (memberData.gender) {
        memberData.gender = String(memberData.gender).toLowerCase().trim();
      }
      if (memberData.marital_status) {
        memberData.marital_status = String(memberData.marital_status).toLowerCase().trim();
      }
      if (memberData.relationship_to_head) {
        memberData.relationship_to_head = String(memberData.relationship_to_head).toLowerCase().trim();
      }
      
      // Ensure dates are in YYYY-MM-DD format for date inputs
      const dateFields: (keyof FamilyMemberFormValue)[] = ['date_of_birth', 'baptism_date', 'first_communion_date', 'confirmation_date'];
      dateFields.forEach(field => {
        const dateValue = memberData[field];
        if (dateValue && typeof dateValue === 'string' && dateValue.includes('T')) {
          // Convert ISO date to YYYY-MM-DD
          memberData[field] = dateValue.split('T')[0];
        }
      });
      
      // Use patchValue with emitEvent false to avoid triggering change detection issues
      // Only patch on first change to prevent overwriting user's edits
      this.form.patchValue(memberData, { emitEvent: false });
      console.log('Form patched with member data:', {
        originalStatus: this.member.status,
        patchedStatus: memberData.status,
        formStatusAfterPatch: this.form.get('status')?.value
      });
    } else if (changes['member'] && !this.member && changes['member'].firstChange) {
      this.isEditMode = false;
      this.errorMessage = null;
      this.form.reset({ relationship_to_head: 'other', marital_status: 'single', status: 'active' });
    }
  }

  /**
   * Get user-friendly error message for a form control
   */
  getErrorMessage(controlName: string): string {
    const control = this.form.get(controlName);
    if (!control || !control.errors || !control.touched) {
      return '';
    }

    const errors = control.errors;
    
    if (errors['required']) {
      switch (controlName) {
        case 'first_name': return 'First name is required';
        case 'last_name': return 'Last name is required';
        case 'relationship_to_head': return 'Relationship to head is required';
        default: return `${this.getFieldLabel(controlName)} is required`;
      }
    }
    
    if (errors['email']) {
      return 'Email address is not in the correct format (e.g., name@example.com)';
    }
    
    if (errors['phoneInvalid']) {
      return 'Phone number is not in the correct format for your country';
    }
    
    if (errors['phoneDialCode']) {
      return `Phone number must start with ${errors['phoneDialCode'].requiredDialCode}`;
    }
    
    if (errors['phoneDigits'] || errors['phoneLocal']) {
      return 'Phone number must contain 6 to 12 digits';
    }
    
    if (errors['pattern']) {
      return `${this.getFieldLabel(controlName)} contains invalid characters`;
    }
    
    if (errors['minlength']) {
      return `${this.getFieldLabel(controlName)} must be at least ${errors['minlength'].requiredLength} characters`;
    }
    
    if (errors['maxlength']) {
      return `${this.getFieldLabel(controlName)} cannot exceed ${errors['maxlength'].requiredLength} characters`;
    }
    
    return `${this.getFieldLabel(controlName)} is invalid`;
  }

  /**
   * Get human-readable field label
   */
  private getFieldLabel(controlName: string): string {
    const labels: { [key: string]: string } = {
      'first_name': 'First name',
      'last_name': 'Last name',
      'middle_name': 'Middle name',
      'date_of_birth': 'Date of birth',
      'gender': 'Gender',
      'relationship_to_head': 'Relationship',
      'marital_status': 'Marital status',
      'phone': 'Phone number',
      'email': 'Email address',
      'occupation': 'Occupation',
      'education': 'Education',
      'baptism_date': 'Baptism date',
      'first_communion_date': 'First communion date',
      'confirmation_date': 'Confirmation date',
      'status': 'Status'
    };
    return labels[controlName] || controlName.replace(/_/g, ' ');
  }

  /**
   * Check if a form control is invalid and has been touched
   */
  isFieldInvalid(controlName: string): boolean {
    const control = this.form.get(controlName);
    return !!(control && control.invalid && control.touched);
  }

  onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      // Clear generic error message - individual field errors will show
      this.errorMessage = null;
      
      // Focus on first invalid field
      const firstInvalidField = Object.keys(this.form.controls).find(key => 
        this.form.get(key)?.invalid
      );
      if (firstInvalidField) {
        const control = this.form.get(firstInvalidField);
        if (control) {
          control.markAsTouched();
          // Try to focus the input element
          setTimeout(() => {
            const element = document.querySelector(`[formControlName="${firstInvalidField}"]`) as HTMLElement;
            if (element) {
              element.focus();
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 100);
        }
      }
      return;
    }
    
    this.errorMessage = null;
    this.saving = true;
    
    // CRITICAL: Get the status directly from the form control FIRST to ensure we have the user's selection
    // This ensures we get the actual selected value, not a stale value from form.value
    const statusControl = this.form.get('status');
    let currentStatus = statusControl?.value || 'active';
    
    // Debug: Log before normalization
    console.log('Status before processing:', {
      rawValue: statusControl?.value,
      currentStatus: currentStatus,
      formValueStatus: this.form.value.status
    });
    
    // Normalize status immediately
    currentStatus = String(currentStatus).toLowerCase().trim();
    
    // Get all form values - use getRawValue to ensure we get the most current values
    const formValue = { ...this.form.getRawValue() };
    delete formValue.id;
    
    // OVERRIDE status with the value from the control to ensure we use the selected value
    // Force update to the normalized value
    formValue.status = currentStatus;
    
    // Ensure status has a valid value
    const validStatuses = ['active', 'inactive', 'deceased', 'migrated'];
    if (!validStatuses.includes(formValue.status)) {
      console.warn('Invalid status value detected:', formValue.status, '- defaulting to active');
      formValue.status = 'active'; // Default fallback
    }
    
    // Normalize other enum-like fields
    if (formValue.gender) {
      formValue.gender = String(formValue.gender).toLowerCase().trim();
    }
    if (formValue.marital_status) {
      formValue.marital_status = String(formValue.marital_status).toLowerCase().trim();
    }
    if (formValue.relationship_to_head) {
      formValue.relationship_to_head = String(formValue.relationship_to_head).toLowerCase().trim();
    }
    
    // Convert empty strings to null for optional fields to allow clearing values
    const optionalFields = ['middle_name', 'date_of_birth', 'gender', 'marital_status', 'phone', 'email', 
                           'occupation', 'education', 'baptism_date', 'first_communion_date', 'confirmation_date'];
    
    optionalFields.forEach(field => {
      if (formValue[field] === '') {
        formValue[field] = null;
      }
    });
    
    // Debug log to verify the status value being sent
    console.log('Form submission - Final values:', {
      status: formValue.status,
      statusControlValue: statusControl?.value,
      fullFormValue: formValue
    });
    
    const value = formValue as FamilyMemberFormValue;
    this.save.emit(value);
    
    // Note: saving flag will be reset by parent component after API call completes
  }

  onCancel(): void {
    this.errorMessage = null;
    this.cancel.emit();
  }
  
  @Input() 
  set error(error: string | null) {
    this.errorMessage = error;
    if (error) {
      this.saving = false;
    }
  }
}


