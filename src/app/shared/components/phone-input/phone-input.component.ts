/**
 * Phone Number Input Component
 * 
 * Reusable phone number input component that:
 * - Displays tenant's country phone code automatically
 * - Restricts input to digits only (no country code prefixes)
 * - Provides consistent validation and formatting
 * - Works with Angular forms (implements ControlValueAccessor)
 * 
 * @author Development Team
 * @date 2025-01-XX
 */

import { Component, Input, OnInit, OnDestroy, forwardRef, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormControl, ReactiveFormsModule, Validators, ValidationErrors } from '@angular/forms';
import { PhoneCodeService } from '@core/services/phone-code.service';

@Component({
  selector: 'app-phone-input',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './phone-input.component.html',
  styleUrl: './phone-input.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PhoneInputComponent),
      multi: true
    }
  ]
})
export class PhoneInputComponent implements ControlValueAccessor, OnInit, OnDestroy {
  @Input() label: string = 'Contact Number';
  @Input() placeholder: string = '';
  @Input() required: boolean = false;
  @Input() disabled: boolean = false;
  @Input() id: string = 'phone-input';
  @Input() name: string = 'phone';
  @Input() maxLength: number = 15; // Maximum phone number length (without country code)
  @Input() minLength: number = 6; // Minimum phone number length
  @Input() showError: boolean = true;
  @Input() errorMessage: string = '';

  private phoneCodeService = inject(PhoneCodeService);

  // Internal form control
  phoneControl = new FormControl('');

  // Phone code from service (reactive)
  phoneCode = signal<string>('+1');

  // Note: PhoneCodeService uses signals (read-only), no subscription needed

  // Value for ControlValueAccessor
  private _value: string = '';
  private _onChange = (value: string) => {};
  private _onTouched = () => {};

  // Validation state
  touched: boolean = false;
  invalid: boolean = false;

  constructor() {
    // Use effect to reactively update phone code when service changes
    effect(() => {
      const code = this.phoneCodeService.currentPhoneCode();
      this.phoneCode.set(code);
    });
  }

  ngOnInit(): void {
    // Initialize phone code from service
    this.phoneCode.set(this.phoneCodeService.getPhoneCodeSync());

    // Note: PhoneCodeService uses signals which are read-only
    // We'll update the phone code in the service initialization and on focus
    // The phone code is reactive via the signal

    // Initialize phone code from API if needed (async)
    this.phoneCodeService.initializeFromApiOnce().subscribe({
      next: (result) => {
        if (result.success) {
          this.phoneCode.set(result.phoneCode);
        }
      },
      error: (err) => {
        console.error('Error initializing phone code:', err);
      }
    });

    // Set up form control with validators
    const validators = [
      Validators.pattern(/^[0-9]*$/), // Only digits
      Validators.maxLength(this.maxLength),
    ];
    
    if (this.required) {
      validators.push(Validators.required);
    }
    
    if (this.minLength > 0) {
      validators.push(Validators.minLength(this.minLength));
    }

    this.phoneControl = new FormControl(this._value || '', validators);

    // Listen to value changes
    this.phoneControl.valueChanges.subscribe(value => {
      const formattedValue = this.formatPhoneNumber(value || '');
      if (formattedValue !== this._value) {
        this._value = formattedValue;
        this._onChange(this._value);
        this.updateValidationState();
      }
    });

    // Listen to status changes for validation
    this.phoneControl.statusChanges.subscribe(() => {
      this.updateValidationState();
    });

    // Set placeholder if not provided
    if (!this.placeholder) {
      this.placeholder = `${this.phoneCode()} 1234567890`;
    }

    // Set disabled state
    if (this.disabled) {
      this.phoneControl.disable();
    }
  }

  ngOnDestroy(): void {
    // No cleanup needed for signals
  }

  /**
   * Format phone number (remove non-digit characters)
   */
  private formatPhoneNumber(value: string): string {
    // Remove all non-digit characters
    return value.replace(/\D/g, '');
  }

  /**
   * Handle input event - restrict to digits only
   */
  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value;

    // Remove all non-digit characters (including +, spaces, dashes, etc.)
    const digitsOnly = this.formatPhoneNumber(value);

    // Limit length
    const limitedValue = digitsOnly.slice(0, this.maxLength);

    // Update input value immediately to prevent non-digit characters from appearing
    if (input.value !== limitedValue) {
      input.value = limitedValue;
    }

    // Update form control value (this will trigger valueChanges)
    if (this.phoneControl.value !== limitedValue) {
      this.phoneControl.setValue(limitedValue, { emitEvent: true });
    }
  }

  /**
   * Handle paste event - clean pasted value
   */
  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pastedText = event.clipboardData?.getData('text') || '';
    
    // Remove country code if present
    const phoneCode = this.phoneCode();
    let cleanedText = pastedText;
    
    // Remove country code prefix if it exists
    if (phoneCode && cleanedText.startsWith(phoneCode)) {
      cleanedText = cleanedText.replace(phoneCode, '').trim();
    } else if (cleanedText.startsWith('+')) {
      // Remove any country code starting with +
      cleanedText = cleanedText.replace(/^\+?\d{1,4}\s*/, '');
    }
    
    // Format to digits only
    const digitsOnly = this.formatPhoneNumber(cleanedText);
    const limitedValue = digitsOnly.slice(0, this.maxLength);

    // Update form control value
    this.phoneControl.setValue(limitedValue, { emitEvent: true });
  }

  /**
   * Handle keydown event - prevent non-digit keys
   */
  onKeyDown(event: KeyboardEvent): void {
    // Allow: backspace, delete, tab, escape, enter, and arrow keys
    if ([8, 9, 27, 13, 46, 37, 38, 39, 40].indexOf(event.keyCode) !== -1 ||
      // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
      (event.keyCode === 65 && event.ctrlKey === true) ||
      (event.keyCode === 67 && event.ctrlKey === true) ||
      (event.keyCode === 86 && event.ctrlKey === true) ||
      (event.keyCode === 88 && event.ctrlKey === true)) {
      return;
    }

    // Ensure that it is a number and stop the keypress
    if ((event.shiftKey || (event.keyCode < 48 || event.keyCode > 57)) && (event.keyCode < 96 || event.keyCode > 105)) {
      event.preventDefault();
    }
  }

  /**
   * Handle blur event
   */
  onBlur(): void {
    this.touched = true;
    this._onTouched();
    this.updateValidationState();
  }

  /**
   * Handle focus event
   */
  onFocus(): void {
    // Ensure phone code is up to date
    this.phoneCode.set(this.phoneCodeService.getPhoneCodeSync());
  }

  /**
   * Update validation state
   */
  private updateValidationState(): void {
    this.invalid = this.touched && this.phoneControl.invalid;
  }

  /**
   * Get error message
   */
  getErrorMessage(): string {
    if (this.errorMessage) {
      return this.errorMessage;
    }

    if (this.phoneControl.hasError('required')) {
      return 'Phone number is required';
    }

    if (this.phoneControl.hasError('pattern')) {
      return 'Phone number must contain only digits';
    }

    if (this.phoneControl.hasError('minlength')) {
      return `Phone number must be at least ${this.minLength} digits`;
    }

    if (this.phoneControl.hasError('maxlength')) {
      return `Phone number must not exceed ${this.maxLength} digits`;
    }

    return '';
  }

  /**
   * Check if field has error
   */
  hasError(): boolean {
    return this.invalid && this.showError;
  }

  /**
   * ControlValueAccessor implementation
   */
  writeValue(value: string): void {
    if (value !== undefined && value !== null && value !== '') {
      let cleanValue = String(value);
      
      // Remove country code prefix if it exists
      // Try current phone code first
      const phoneCode = this.phoneCode();
      if (phoneCode && cleanValue.startsWith(phoneCode)) {
        cleanValue = cleanValue.replace(phoneCode, '').trim();
      } 
      // Remove any country code starting with + (pattern: +1, +91, etc.)
      else if (cleanValue.startsWith('+')) {
        // Match patterns like +1, +91, +123, etc. (1-4 digits after +)
        cleanValue = cleanValue.replace(/^\+\d{1,4}[\s\-]?/, '').trim();
      }
      // Remove patterns like (1) or [1] (country code in brackets)
      else if (cleanValue.match(/^[\(\[]\d{1,4}[\)\]]/)) {
        cleanValue = cleanValue.replace(/^[\(\[]\d{1,4}[\)\]][\s\-]?/, '').trim();
      }

      // Format to digits only (remove all non-digit characters)
      cleanValue = this.formatPhoneNumber(cleanValue);
      
      // Limit length
      cleanValue = cleanValue.slice(0, this.maxLength);
      
      this._value = cleanValue;
      this.phoneControl.setValue(cleanValue, { emitEvent: false });
    } else {
      this._value = '';
      this.phoneControl.setValue('', { emitEvent: false });
    }
  }

  registerOnChange(fn: (value: string) => void): void {
    this._onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this._onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    if (isDisabled) {
      this.phoneControl.disable();
    } else {
      this.phoneControl.enable();
    }
  }

  /**
   * Get full phone number with country code (for display or submission)
   */
  getFullPhoneNumber(): string {
    const phoneCode = this.phoneCode();
    const number = this.phoneControl.value || '';
    
    if (!number) {
      return '';
    }

    return `${phoneCode} ${number}`;
  }

  /**
   * Validate phone number
   */
  validate(): ValidationErrors | null {
    if (this.required && !this.phoneControl.value) {
      return { required: true };
    }

    if (this.phoneControl.value && !/^[0-9]+$/.test(this.phoneControl.value)) {
      return { pattern: true };
    }

    if (this.phoneControl.value && this.phoneControl.value.length < this.minLength) {
      return { minlength: { requiredLength: this.minLength, actualLength: this.phoneControl.value.length } };
    }

    if (this.phoneControl.value && this.phoneControl.value.length > this.maxLength) {
      return { maxlength: { requiredLength: this.maxLength, actualLength: this.phoneControl.value.length } };
    }

    return null;
  }
}

