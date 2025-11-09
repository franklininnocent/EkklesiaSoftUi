import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { PhoneCodeService } from '../../../../core/services/phone-code.service';
import { AuthService } from '@core/services';
import { getCountryCallingCode, CountryCode } from 'libphonenumber-js';

export interface FamilyMemberFormValue {
  // CRITICAL: ID must be string (UUID) to match FamilyMember model
  id?: string | null;
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
  baptism_place?: string;
  baptism_godparent_primary?: string;
  baptism_godparent_secondary?: string;
  baptism_location_type?: 'home_parish' | 'other';
  baptism_church_name?: string;
  baptism_church_address?: string;
  baptism_priest_name?: string;
  baptism_priest_is_home?: boolean | null;
  first_communion_date?: string;
  first_communion_place?: string;
  confirmation_date?: string;
  confirmation_place?: string;
  marriage_date?: string;
  marriage_place?: string;
  marriage_spouse_name?: string;
  marriage_bride_full_name?: string;
  marriage_bride_address?: string;
  marriage_bride_church_type?: 'home_parish' | 'other';
  marriage_bride_church_name?: string;
  marriage_bride_church_address?: string;
  marriage_groom_full_name?: string;
  marriage_groom_address?: string;
  marriage_groom_church_type?: 'home_parish' | 'other';
  marriage_groom_church_name?: string;
  marriage_groom_church_address?: string;
  status?: string;
}

function createLocalPhoneValidator(getDialCode: () => string): ValidatorFn {
  return (control: AbstractControl) => {
    const raw = (control.value ?? '').toString().trim();
    if (!raw) {
      return null;
    }

    if (raw.startsWith('+')) {
      return { phoneDialCode: { requiredDialCode: getDialCode() || '' } };
    }

    const digitsOnly = raw.replace(/\D/g, '');
    if (digitsOnly.length < 6 || digitsOnly.length > 12) {
      return { phoneDigits: true };
    }

    // Allow digits and common separators only
    if (/[^0-9\s\-().]/.test(raw)) {
      return { phoneInvalid: true };
    }

    return null;
  };
}

@Component({
  selector: 'app-family-member-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './family-member-form-modal.component.html',
  styleUrls: ['./family-member-form-modal.component.scss']
})
export class FamilyMemberFormModalComponent implements OnInit, OnChanges {
  @Input() member: FamilyMemberFormValue | null = null;
  @Input() isHeadOnly: boolean = false; // When true, relationship is locked to "Family Head" (self)
  @Input()
  set saving(value: boolean) {
    this._saving = value;
  }
  get saving(): boolean {
    return this._saving;
  }
  @Output() save = new EventEmitter<FamilyMemberFormValue>();
  @Output() cancel = new EventEmitter<void>();

  form: FormGroup;
  private _saving = false;
  isEditMode = false;
  get callingCode(): string { return this.phoneCodeService.getPhoneCodeSync(); }
  errorMessage: string | null = null;
  private lastMemberId: string | null = null; // Track last member ID to prevent unnecessary patches

  constructor(
    private fb: FormBuilder, 
    private phoneCodeService: PhoneCodeService,
    private authService: AuthService
  ) {
    this.form = this.fb.group({
      // ID stored as string (UUID), not number
      id: [null as string | null],
      first_name: ['', Validators.required],
      middle_name: [''],
      last_name: ['', Validators.required],
      date_of_birth: [''],
      gender: [''],
      relationship_to_head: ['other', Validators.required],
      marital_status: ['single'],
      phone: ['', createLocalPhoneValidator(() => this.callingCode)],
      email: ['', Validators.email],
      occupation: [''],
      education: [''],
      baptism_date: [''],
      baptism_place: [''],
      baptism_godparent_primary: [''],
      baptism_godparent_secondary: [''],
      baptism_location_type: ['home_parish'],
      baptism_church_name: [''],
      baptism_church_address: [''],
      baptism_priest_name: [''],
      baptism_priest_is_home: [true],
      first_communion_date: [''],
      first_communion_place: [''],
      confirmation_date: [''],
      confirmation_place: [''],
      marriage_date: [''],
      marriage_place: [''],
      marriage_spouse_name: [''],
      marriage_bride_full_name: [''],
      marriage_bride_address: [''],
      marriage_bride_church_type: ['home_parish'],
      marriage_bride_church_name: [''],
      marriage_bride_church_address: [''],
      marriage_groom_full_name: [''],
      marriage_groom_address: [''],
      marriage_groom_church_type: ['home_parish'],
      marriage_groom_church_name: [''],
      marriage_groom_church_address: [''],
      status: ['active']
    });
  }

  ngOnInit(): void {
    // Ensure phone code reflects current tenant's country from Church Profile
    this.initializePhoneCode();

    // If still defaulting to +1, hydrate from API once
    if (this.callingCode === '+1') {
      this.phoneCodeService.initializeFromApiOnce().subscribe({
        next: (res) => {
          console.log('📞 Family Member Modal - Phone code hydrated from API:', res);
          // Force change detection if needed
          if (res.success && res.phoneCode !== '+1') {
            // Phone code updated successfully
          }
        },
        error: (e) => console.warn('⚠️ Family Member Modal - Phone code API hydrate error', e)
      });
    }
  }

  /**
   * Initialize phone code from tenant country (Church Profile)
   */
  private initializePhoneCode(): void {
    try {
      const user = this.authService.currentUserValue as any;
      console.log('🔍 Family Member Modal - Initializing phone code, user:', user);

      // Try to get country code from user's tenant
      let iso2: string | undefined = user?.tenant?.country_code || user?.tenant?.country?.iso2;

      // If not found in user, try localStorage
      if (!iso2) {
        try {
          iso2 = localStorage.getItem('tenant_country_code') || undefined;
          console.log('📦 Family Member Modal - Using cached tenant_country_code from localStorage:', iso2);
        } catch {}
      }

      if (iso2 && typeof iso2 === 'string' && iso2.length >= 2) {
        const upper = iso2.toUpperCase();
        try {
          const code = getCountryCallingCode(upper as CountryCode);
          if (code) {
            const phoneCode = `+${code}`;
            console.log(`✅ Family Member Modal - Setting phone code to ${phoneCode} for country ${upper}`);
            this.phoneCodeService.setPhoneCode(phoneCode);
            // Cache for other parts of app
            try { localStorage.setItem('tenant_country_code', upper); } catch {}
          } else {
            console.warn(`⚠️ Family Member Modal - Could not get calling code for ISO2: ${upper}`);
          }
        } catch (error) {
          console.error('❌ Family Member Modal - Error getting country calling code:', error);
        }
      } else {
        console.warn('⚠️ Family Member Modal - No country code found. User tenant:', user?.tenant);
        // Log current phone code to debug
        console.log('📞 Family Member Modal - Current phone code from service:', this.phoneCodeService.getPhoneCodeSync());
      }
    } catch (error) {
      console.error('❌ Family Member Modal - Error initializing phone code:', error);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Re-initialize phone code when modal opens (member input changes)
    if (changes['member'] && (changes['member'].currentValue !== changes['member'].previousValue)) {
      // Modal is opening or member is changing - ensure phone code is correct
      this.initializePhoneCode();
      
      // If still +1, try to hydrate from API
      if (this.callingCode === '+1') {
        this.phoneCodeService.initializeFromApiOnce().subscribe({
          next: (res) => console.log('📞 Family Member Modal - Phone code re-hydrated on member change:', res),
          error: (e) => console.warn('⚠️ Family Member Modal - Phone code re-hydrate error', e)
        });
      }
    }
    // Only patch form if member actually changed (prevents infinite loop)
    if (changes['member'] || changes['isHeadOnly']) {
      const currentMemberId = this.member?.id || null;
      
      // Check if this is a different member (or first time setting)
      const isNewMember = currentMemberId !== this.lastMemberId;
      
      if (this.member) {
        // Edit mode - populate form with member data only if it's a different member
        if (isNewMember) {
          this.isEditMode = true;
          this.errorMessage = null;
          this.lastMemberId = currentMemberId;
          this.populateFormWithMember(this.member);
          
          // CRITICAL: If isHeadOnly mode, ensure relationship is set to 'self'
          if (this.isHeadOnly) {
            this.form.get('relationship_to_head')?.setValue('self', { emitEvent: false });
          }
        }
        // If same member, don't repatch (allows user to edit)
      } else {
        // Add mode - reset form to defaults
        if (this.lastMemberId !== null || changes['isHeadOnly']) {
          // Only reset if we were previously in edit mode or isHeadOnly changed
          this.isEditMode = false;
          this.errorMessage = null;
          this.lastMemberId = null;
          this.form.reset({ 
            id: null,
            relationship_to_head: this.isHeadOnly ? 'self' : 'other', 
            marital_status: 'single', 
            status: 'active' 
          });
          
          // CRITICAL: If isHeadOnly mode, ensure relationship is set to 'self'
          if (this.isHeadOnly) {
            this.form.get('relationship_to_head')?.setValue('self', { emitEvent: false });
          }
        }
      }
    }
  }

  /**
   * Populate form with member data, handling all fields properly
   */
  private populateFormWithMember(member: FamilyMemberFormValue): void {
    // Prepare member data for form - handle date formats and normalize values
    const memberData: any = { ...member };
    
    // Ensure ID is included
    if (member.id !== undefined && member.id !== null) {
      memberData.id = member.id;
    }
    
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
    
    // CRITICAL: Normalize relationship_to_head and map to correct dropdown values
    // If isHeadOnly mode, always set to 'self'
    if (this.isHeadOnly) {
      memberData.relationship_to_head = 'self';
    } else if (memberData.relationship_to_head) {
      const rel = String(memberData.relationship_to_head).toLowerCase().trim();
      // Map "head" and "head of family" to "self" to match dropdown option
      if (rel === 'head' || rel === 'head of family' || rel === 'self') {
        memberData.relationship_to_head = 'self';
      } else {
        memberData.relationship_to_head = rel;
      }
    } else {
      // If relationship is missing, check if this is a head member by ID or other indicators
      // But don't default to 'other' - keep it empty if truly missing
      memberData.relationship_to_head = '';
    }
    
    // Log relationship normalization only if it changed
    if (member?.relationship_to_head && memberData.relationship_to_head !== String(member.relationship_to_head).toLowerCase().trim()) {
      console.log('🔍 Relationship normalization:', {
        original: member?.relationship_to_head,
        normalized: memberData.relationship_to_head
      });
    }
    
    // Ensure dates are in YYYY-MM-DD format for date inputs
    const dateFields: (keyof FamilyMemberFormValue)[] = ['date_of_birth', 'baptism_date', 'first_communion_date', 'confirmation_date', 'marriage_date'];
    dateFields.forEach(field => {
      const dateValue = memberData[field];
      if (dateValue && typeof dateValue === 'string') {
        // Convert ISO date to YYYY-MM-DD
        if (dateValue.includes('T')) {
          memberData[field] = dateValue.split('T')[0];
        } else if (dateValue.includes(' ')) {
          // Handle other date formats
          memberData[field] = dateValue.split(' ')[0];
        }
      } else if (dateValue === null || dateValue === undefined) {
        // Ensure empty dates are set to empty string for date inputs
        memberData[field] = '';
      }
    });
    
    // Handle phone number - ensure it's properly formatted
    if (memberData.phone) {
      memberData.phone = this.stripCountryCode(memberData.phone);
    } else {
      memberData.phone = '';
    }
    
    // Handle other string fields - ensure they're strings or empty strings
    const stringFields: (keyof FamilyMemberFormValue)[] = [
      'first_name', 'middle_name', 'last_name', 'email', 
      'occupation', 'education', 'gender', 'relationship_to_head', 
      'marital_status', 'phone', 'marriage_place', 'marriage_spouse_name',
      'baptism_place', 'first_communion_place', 'confirmation_place',
      'baptism_godparent_primary', 'baptism_godparent_secondary',
      'baptism_location_type', 'baptism_church_name', 'baptism_church_address',
      'baptism_priest_name', 'marriage_bride_full_name', 'marriage_bride_address',
      'marriage_bride_church_type', 'marriage_bride_church_name', 'marriage_bride_church_address',
      'marriage_groom_full_name', 'marriage_groom_address', 'marriage_groom_church_type',
      'marriage_groom_church_name', 'marriage_groom_church_address'
    ];
    
    stringFields.forEach(field => {
      if (memberData[field] === null || memberData[field] === undefined) {
        memberData[field] = '';
      } else {
        memberData[field] = String(memberData[field]).trim();
      }
    });

    if (memberData.baptism_location_type && typeof memberData.baptism_location_type === 'string') {
      const normalized = memberData.baptism_location_type.toLowerCase().trim();
      memberData.baptism_location_type = normalized === 'other' ? 'other' : 'home_parish';
    } else {
      memberData.baptism_location_type = 'home_parish';
    }

    if (memberData.baptism_priest_is_home === null || memberData.baptism_priest_is_home === undefined) {
      memberData.baptism_priest_is_home = true;
    } else {
      memberData.baptism_priest_is_home = Boolean(memberData.baptism_priest_is_home);
    }

    if (!memberData.marriage_bride_church_type) {
      memberData.marriage_bride_church_type = 'home_parish';
    }

    if (!memberData.marriage_groom_church_type) {
      memberData.marriage_groom_church_type = 'home_parish';
    }
    
    // Use patchValue with emitEvent false to avoid triggering change detection issues
    this.form.patchValue(memberData, { emitEvent: false });
    
    // CRITICAL: Double-check that relationship was set correctly
    // If isHeadOnly mode, always ensure it's 'self'
    if (this.isHeadOnly) {
      this.form.get('relationship_to_head')?.setValue('self', { emitEvent: false });
    } else {
      const relationshipValue = this.form.get('relationship_to_head')?.value;
      if (!relationshipValue || relationshipValue === 'other') {
        // If relationship wasn't set or defaulted to 'other', try to set it from memberData
        if (memberData.relationship_to_head) {
          this.form.get('relationship_to_head')?.setValue(memberData.relationship_to_head, { emitEvent: false });
          console.warn('⚠️ Relationship was not set correctly, manually setting:', memberData.relationship_to_head);
        }
      }
    }
    
    // Reduced logging - only log key fields
    console.log('✅ Form patched with member:', {
      id: this.form.get('id')?.value,
      name: `${this.form.get('first_name')?.value} ${this.form.get('last_name')?.value}`,
      relationship: this.form.get('relationship_to_head')?.value
    });
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
      return 'Phone number can only include digits, spaces, parentheses, or hyphens';
    }
    
    if (errors['phoneDialCode']) {
      return `Do not include the country code. It will be added automatically (${errors['phoneDialCode'].requiredDialCode}).`;
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
    this._saving = true;
    
    // CRITICAL: If isHeadOnly mode, ensure relationship is always 'self'
    if (this.isHeadOnly) {
      this.form.get('relationship_to_head')?.setValue('self', { emitEvent: false });
    }
    
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
    
    // CRITICAL: Preserve ID if it exists (needed for updates) - do NOT delete it
    // The ID will be used by the backend to determine if this is an update or new member
    const formId = this.form.get('id')?.value;
    if (formId !== null && formId !== undefined && formId !== '') {
      formValue.id = String(formId).trim();
      console.log('✅ Member form ID preserved:', formValue.id);
    } else {
      console.warn('⚠️ No ID in form when saving member');
    }
    
    // OVERRIDE status with the value from the control to ensure we use the selected value
    // Force update to the normalized value
    formValue.status = currentStatus;
    
    // Ensure status has a valid value
    const validStatuses = ['active', 'inactive', 'deceased', 'migrated'];
    if (!validStatuses.includes(formValue.status)) {
      console.warn('Invalid status value detected:', formValue.status, '- defaulting to active');
      formValue.status = 'active'; // Default fallback
    }
    
    // CRITICAL: If isHeadOnly mode, force relationship to 'self'
    if (this.isHeadOnly) {
      formValue.relationship_to_head = 'self';
      console.log('✅ Head-only mode: Relationship locked to "self"');
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
    const optionalFields = ['middle_name', 'date_of_birth', 'gender', 'marital_status', 'email', 
                           'occupation', 'education', 'baptism_date', 'baptism_place',
                           'baptism_godparent_primary', 'baptism_godparent_secondary',
                           'baptism_location_type', 'baptism_church_name', 'baptism_church_address',
                           'baptism_priest_name', 'first_communion_date', 'first_communion_place',
                           'confirmation_date', 'confirmation_place', 'marriage_date', 'marriage_place',
                           'marriage_spouse_name', 'marriage_bride_full_name', 'marriage_bride_address',
                           'marriage_bride_church_type', 'marriage_bride_church_name', 'marriage_bride_church_address',
                           'marriage_groom_full_name', 'marriage_groom_address', 'marriage_groom_church_type',
                           'marriage_groom_church_name', 'marriage_groom_church_address'];
    
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
    
    // Ensure phone has country code applied (user enters local part only)
    formValue.phone = this.formatPhoneForApi(formValue.phone);
    
    const value = formValue as FamilyMemberFormValue;
    this.save.emit(value);
    
    // Note: saving flag will be reset by parent component after API call completes
  }

  onCancel(): void {
    this.errorMessage = null;
    this._saving = false;
    this.cancel.emit();
  }
  
  @Input() 
  set error(error: string | null) {
    this.errorMessage = error;
    if (error) {
      this._saving = false;
    }
  }

  /**
   * Remove the selected country dial code from a phone number so users enter only the local part.
   */
  private stripCountryCode(phone: string | null | undefined): string {
    if (!phone) {
      return '';
    }

    const raw = String(phone).trim();
    if (!raw) {
      return '';
    }

    const dialCode = this.callingCode || '';
    const digitsOnlyDial = dialCode.replace(/\D/g, '');
    const digitsOnlyPhone = raw.replace(/\D/g, '');

    if (!digitsOnlyDial || !digitsOnlyPhone) {
      return raw.replace(/^\+/, '');
    }

    if (digitsOnlyPhone.startsWith(digitsOnlyDial)) {
      return digitsOnlyPhone.substring(digitsOnlyDial.length);
    }

    return digitsOnlyPhone;
  }

  /**
   * Apply the current country dial code to the phone input before submitting to parent/API.
   */
  private formatPhoneForApi(raw: string | null | undefined): string | null {
    if (raw === null || raw === undefined) {
      return null;
    }

    const trimmed = String(raw).trim();
    if (!trimmed) {
      return null;
    }

    const digits = trimmed.replace(/\D/g, '');
    if (!digits) {
      return null;
    }

    const dialCodeRaw = this.callingCode || '';
    const dialCode = dialCodeRaw.startsWith('+') ? dialCodeRaw : `+${dialCodeRaw}`;
    const dialDigits = dialCode.replace(/\D/g, '');

    if (!dialDigits) {
      return `+${digits}`;
    }

    if (digits.startsWith(dialDigits)) {
      return `+${digits}`;
    }

    return `${dialCode}${digits}`;
  }
}


