/**
 * Phone Code Service
 * 
 * Centralized service for managing phone codes based on country selection.
 * Provides reusable functionality for automatic phone code updates across the entire application.
 * 
 * Follows Angular 20 best practices with signals, RxJS, and proper error handling.
 * 
 * @see cursor.rules sections 7 (Frontend), 10 (Advanced Technology Usage)
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { GeographyService, Country } from './geography.service';
import { getTenantCallingCode } from '@core/validators/phone.validators';
import { getCountryCallingCode, CountryCode } from 'libphonenumber-js';

/**
 * Phone code update result
 */
export interface PhoneCodeUpdateResult {
  success: boolean;
  phoneCode: string;
  countryId?: number;
  countryName?: string;
  source: 'database' | 'libphonenumber' | 'default';
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PhoneCodeService {
  private geographyService = inject(GeographyService);

  // Current phone code as a signal for reactive updates
  private _currentPhoneCode = signal<string>(getTenantCallingCode());
  
  // Current country ID
  private _currentCountryId = signal<number | null>(null);

  // Expose signals as readonly
  public readonly currentPhoneCode = this._currentPhoneCode.asReadonly();
  public readonly currentCountryId = this._currentCountryId.asReadonly();

  // Computed property for display
  public readonly displayPhoneCode = computed(() => {
    const code = this._currentPhoneCode();
    return code;
  });

  /**
   * Update phone code based on country ID
   * This is the main method that should be called when country changes
   * 
   * @param countryId The ID of the selected country
   * @param countries Optional array of countries (if already loaded, improves performance)
   * @returns Observable<PhoneCodeUpdateResult> Result of the update operation
   */
  updatePhoneCodeByCountryId(
    countryId: number | null,
    countries?: Country[]
  ): Observable<PhoneCodeUpdateResult> {
    // Handle null or invalid country ID
    if (!countryId || countryId === 0) {
      const defaultCode = getTenantCallingCode();
      this._currentPhoneCode.set(defaultCode);
      this._currentCountryId.set(null);
      
      return of({
        success: true,
        phoneCode: defaultCode,
        source: 'default'
      });
    }

    // Update country ID immediately
    this._currentCountryId.set(countryId);

    // If countries array is provided, use it directly
    if (countries && countries.length > 0) {
      const result = this.findAndUpdatePhoneCode(countryId, countries);
      return of(result);
    }

    // Otherwise, get countries from GeographyService and map to result
    return this.geographyService.getCountries().pipe(
      tap(response => {
        if (response.success && response.data) {
          this.findAndUpdatePhoneCode(countryId, response.data);
        }
      }),
      // Map GeographyResponse to PhoneCodeUpdateResult
      map((response): PhoneCodeUpdateResult => {
        if (response.success && response.data) {
          return this.findAndUpdatePhoneCode(countryId, response.data);
        } else {
          const defaultCode = getTenantCallingCode();
          this._currentPhoneCode.set(defaultCode);
          return {
            success: false,
            phoneCode: defaultCode,
            source: 'default',
            error: 'Failed to load countries'
          };
        }
      }),
      catchError(error => {
        console.error('❌ Error loading countries for phone code update:', error);
        const defaultCode = getTenantCallingCode();
        this._currentPhoneCode.set(defaultCode);
        return of({
          success: false,
          phoneCode: defaultCode,
          source: 'default' as const,
          error: 'Failed to load countries'
        });
      })
    );
  }

  /**
   * Find country and update phone code
   * Internal helper method
   */
  private findAndUpdatePhoneCode(countryId: number, countries: Country[]): PhoneCodeUpdateResult {
    const country = countries.find(c => c.id === countryId);

    if (!country) {
      console.warn(`⚠️ Country with ID ${countryId} not found`);
      const defaultCode = getTenantCallingCode();
      this._currentPhoneCode.set(defaultCode);
      
      return {
        success: false,
        phoneCode: defaultCode,
        source: 'default',
        error: `Country with ID ${countryId} not found`
      };
    }

    let phoneCode: string;
    let source: 'database' | 'libphonenumber' | 'default' = 'default';

    // Priority 1: Use phone_code from database (most reliable)
    if (country.phone_code) {
      phoneCode = country.phone_code.startsWith('+')
        ? country.phone_code
        : `+${country.phone_code}`;
      source = 'database';
    }
    // Priority 2: Use libphonenumber-js with ISO2 code
    else if (country.iso2) {
      try {
        const iso2Upper = country.iso2.toUpperCase();
        const code = getCountryCallingCode(iso2Upper as CountryCode);
        phoneCode = `+${code}`;
        source = 'libphonenumber';
      } catch (error) {
        console.warn(`⚠️ Could not get calling code for ISO2: ${country.iso2}`, error);
        phoneCode = getTenantCallingCode();
        source = 'default';
      }
    }
    // Fallback: Use default tenant calling code
    else {
      console.warn(`⚠️ Country ${country.name} has no phone_code or ISO2`);
      phoneCode = getTenantCallingCode();
      source = 'default';
    }

    // Update signal
    this._currentPhoneCode.set(phoneCode);

    return {
      success: true,
      phoneCode,
      countryId: country.id,
      countryName: country.name,
      source
    };
  }

  /**
   * Get phone code synchronously (if country is already set)
   * Returns the current phone code without async operations
   */
  getPhoneCodeSync(): string {
    return this._currentPhoneCode();
  }

  /**
   * Set phone code manually (useful for initialization)
   * 
   * @param phoneCode The phone code to set (with or without +)
   */
  setPhoneCode(phoneCode: string): void {
    const formattedCode = phoneCode.startsWith('+') ? phoneCode : `+${phoneCode}`;
    this._currentPhoneCode.set(formattedCode);
  }

  /**
   * Reset phone code to default
   */
  resetToDefault(): void {
    this._currentPhoneCode.set(getTenantCallingCode());
    this._currentCountryId.set(null);
  }

  /**
   * Get phone code for a specific country ID synchronously
   * Requires countries array to be provided
   * 
   * @param countryId The country ID
   * @param countries Array of countries
   * @returns Phone code string or null if country not found
   */
  getPhoneCodeForCountry(countryId: number | null, countries: Country[]): string | null {
    if (!countryId || countryId === 0 || !countries || countries.length === 0) {
      return null;
    }

    const country = countries.find(c => c.id === countryId);
    if (!country) {
      return null;
    }

    // Try phone_code from database first
    if (country.phone_code) {
      return country.phone_code.startsWith('+')
        ? country.phone_code
        : `+${country.phone_code}`;
    }

    // Fallback to libphonenumber-js
    if (country.iso2) {
      try {
        const code = getCountryCallingCode(country.iso2.toUpperCase() as CountryCode);
        return `+${code}`;
      } catch (error) {
        console.warn(`Could not get calling code for ISO2: ${country.iso2}`, error);
      }
    }

    return null;
  }
}

