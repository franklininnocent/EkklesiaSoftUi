/**
 * Phone Code Update Directive
 * 
 * Automatic phone code update directive that can be applied to country select elements.
 * Automatically updates phone code when country changes.
 * 
 * Usage:
 *   <ng-select
 *     [(ngModel)]="countryId"
 *     appPhoneCodeUpdate
 *     [phoneCodeControl]="phoneCodeControl"
 *     [countries]="countries">
 *   </ng-select>
 * 
 * Or with reactive forms:
 *   <ng-select
 *     [formControl]="countryFormControl"
 *     appPhoneCodeUpdate
 *     [phoneCodeControl]="phoneCodeControl"
 *     [countries]="countries">
 *   </ng-select>
 * 
 * Follows Angular 20 best practices with standalone directives and proper lifecycle management.
 * 
 * @see cursor.rules sections 7 (Frontend), 10 (Advanced Technology Usage)
 */

import {
  Directive,
  Input,
  OnInit,
  OnDestroy,
  ElementRef,
  Optional,
  Self,
  inject
} from '@angular/core';
import { NgControl, AbstractControl } from '@angular/forms';
import { NgModel } from '@angular/forms';
import { Subscription } from 'rxjs';
import { PhoneCodeService } from '@core/services/phone-code.service';
import { GeographyService, Country } from '@core/services/geography.service';

@Directive({
  selector: '[appPhoneCodeUpdate]',
  standalone: true
})
export class PhoneCodeUpdateDirective implements OnInit, OnDestroy {
  private phoneCodeService = inject(PhoneCodeService);
  private geographyService = inject(GeographyService);
  private elementRef = inject(ElementRef);

  // Reference to the form control for phone code (to update its value)
  @Input() phoneCodeControl?: AbstractControl | null;

  // Optional: Countries array (if already loaded, improves performance)
  @Input() countries?: Country[];

  // Optional: Property name to update (if phoneCodeControl is not provided)
  // This will update a component property using a callback
  @Input() phoneCodeProperty?: string;

  // Optional: Callback function to call when phone code updates
  @Input() onPhoneCodeUpdate?: (phoneCode: string) => void;

  private subscriptions: Subscription[] = [];
  private ngModel?: NgModel;
  private formControl?: NgControl;

  constructor(
    @Optional() @Self() private ngControl: NgControl,
    @Optional() @Self() private ngModelDirective: NgModel
  ) {
    // Support both NgModel and NgControl
    if (ngModelDirective) {
      this.ngModel = ngModelDirective;
    }
    if (ngControl) {
      this.formControl = ngControl;
    }
  }

  ngOnInit(): void {
    // Subscribe to country changes
    if (this.ngModel) {
      // Template-driven form
      this.subscriptions.push(
        this.ngModel.valueChanges?.subscribe((countryId: number | null) => {
          this.handleCountryChange(countryId);
        }) || new Subscription()
      );
    } else if (this.formControl?.valueChanges) {
      // Reactive form
      this.subscriptions.push(
        this.formControl.valueChanges.subscribe((countryId: number | null) => {
          this.handleCountryChange(countryId);
        })
      );
    }
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Handle country change and update phone code
   */
  private handleCountryChange(countryId: number | null): void {
    if (!countryId || countryId === 0) {
      // Reset to default if no country selected
      const defaultCode = this.phoneCodeService.getPhoneCodeSync();
      this.updatePhoneCode(defaultCode);
      return;
    }

    // If countries array is provided, use it for synchronous lookup
    if (this.countries && this.countries.length > 0) {
      const phoneCode = this.phoneCodeService.getPhoneCodeForCountry(
        countryId,
        this.countries
      );
      
      if (phoneCode) {
        this.updatePhoneCode(phoneCode);
      } else {
        // Fallback to async lookup
        this.updatePhoneCodeAsync(countryId);
      }
    } else {
      // Async lookup via service
      this.updatePhoneCodeAsync(countryId);
    }
  }

  /**
   * Update phone code asynchronously
   */
  private updatePhoneCodeAsync(countryId: number): void {
    this.phoneCodeService.updatePhoneCodeByCountryId(countryId, this.countries).subscribe({
      next: (result) => {
        if (result.success) {
          this.updatePhoneCode(result.phoneCode);
        } else {
          console.warn('Failed to update phone code:', result.error);
        }
      },
      error: (error) => {
        console.error('Error updating phone code:', error);
      }
    });
  }

  /**
   * Update phone code in the specified control/property/callback
   */
  private updatePhoneCode(phoneCode: string): void {
    // Priority 1: Update form control if provided
    if (this.phoneCodeControl) {
      this.phoneCodeControl.setValue(phoneCode, { emitEvent: false });
      return;
    }

    // Priority 2: Call callback if provided
    if (this.onPhoneCodeUpdate) {
      this.onPhoneCodeUpdate(phoneCode);
      return;
    }

    // Priority 3: Update component property via ElementRef (if property name provided)
    if (this.phoneCodeProperty && this.elementRef) {
      try {
        const component = (this.elementRef.nativeElement as any).__ngContext__?.[8];
        if (component && typeof component[this.phoneCodeProperty] !== 'undefined') {
          component[this.phoneCodeProperty] = phoneCode;
        }
      } catch (error) {
        console.warn('Could not update component property:', error);
      }
    }

    // Also update the service's current phone code
    this.phoneCodeService.setPhoneCode(phoneCode);
  }
}

