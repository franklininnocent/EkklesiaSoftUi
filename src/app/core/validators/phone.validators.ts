import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { parsePhoneNumberFromString, CountryCode, getCountryCallingCode } from 'libphonenumber-js';

/**
 * Normalize a phone string: remove spaces, hyphens, parentheses and dots
 */
function normalizePhone(input: string): string {
  return input.replace(/[\s\-().]/g, '');
}

/**
 * Create a validator that verifies phone numbers in E.164-like format using the tenant dial code
 * - If value starts with '+', it must start with +{dialCode} and contain 6-12 further digits
 * - If value doesn't start with '+', it's treated as local: must be 6-12 digits; we validate digits only
 * - Empty values are valid (use separate required validator if needed)
 */
export function phoneNumberValidator(getTenantDialCode: () => string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw: string = (control.value ?? '').toString();
    if (!raw) return null; // not required here

    const dialCode = (getTenantDialCode() || '+1').toString();
    const normalized = normalizePhone(raw);

    // '+' present => enforce starts with dial code
    if (normalized.startsWith('+')) {
      if (!normalized.startsWith(dialCode)) {
        return { phoneDialCode: { requiredDialCode: dialCode, actual: raw } };
      }
      const rest = normalized.substring(dialCode.length);
      if (!/^\d{6,12}$/.test(rest)) {
        return { phoneDigits: true };
      }
      return null;
    }

    // Local number: digits only, reasonable length
    if (!/^\d{6,12}$/.test(normalized)) {
      return { phoneLocal: true };
    }

    return null;
  };
}

/**
 * Returns the current tenant's ISO country code.
 * Looks for a global auth/tenant object first, then localStorage, defaults to 'US'.
 */
export function getTenantCountryCode(): string {
  try {
    const anyWindow: any = window as any;
    const codeFromAuth = anyWindow?.__CURRENT_TENANT__?.country_code || anyWindow?.__CURRENT_USER__?.tenant?.country_code;
    if (typeof codeFromAuth === 'string' && codeFromAuth.length >= 2) {
      return codeFromAuth.toUpperCase();
    }
  } catch {}
  const ls = localStorage.getItem('tenant_country_code');
  if (ls && ls.length >= 2) return ls.toUpperCase();
  return 'US';
}

/** Returns "+<callingCode>" for tenant's country (e.g., "+1", "+91"). */
export function getTenantCallingCode(): string {
  const cc = getTenantCountryCode() as CountryCode;
  try {
    const code = getCountryCallingCode(cc);
    return `+${code}`;
  } catch {
    return '+1';
  }
}

/**
 * Validates that the control contains a valid phone number for the tenant's country.
 * - Allows empty values (use with Validators.required if required)
 * - Trims whitespace; optionally accepts numbers with/without '+' prefix
 */
export function tenantPhoneValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = (control.value ?? '').toString().trim();
    if (!raw) return null;

    const countryStr = getTenantCountryCode();
    const country = countryStr as CountryCode;
    try {
      const parsed = parsePhoneNumberFromString(raw, country);
      if (parsed && parsed.isValid()) {
        return null;
      }
    } catch {}

    return { phoneInvalid: { country: countryStr, value: raw } };
  };
}
