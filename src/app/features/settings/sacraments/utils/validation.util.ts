/**
 * Validation Utility
 * Centralized validation functions for Sacraments module
 */

import { DATE_VALIDATION, VALIDATION_MESSAGES } from '../constants/sacrament.constants';

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * Validate date is not too far in the future
 */
export function validateDateNotFuture(date: string | null | undefined): ValidationResult {
  if (!date) {
    return { valid: false, message: VALIDATION_MESSAGES.REQUIRED };
  }

  const adminDate = new Date(date);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + DATE_VALIDATION.MAX_FUTURE_DAYS);
  tomorrow.setHours(23, 59, 59, 999);

  if (adminDate > tomorrow) {
    return {
      valid: false,
      message: VALIDATION_MESSAGES.FUTURE_DATE
    };
  }

  // Check if date is valid
  if (isNaN(adminDate.getTime())) {
    return {
      valid: false,
      message: VALIDATION_MESSAGES.INVALID_DATE
    };
  }

  return { valid: true };
}

/**
 * Validate certificate number format
 * Format: Alphanumeric, optional dashes, typically 6-20 characters
 */
export function validateCertificateNumber(certificateNumber: string | null | undefined): ValidationResult {
  if (!certificateNumber || certificateNumber.trim() === '') {
    return { valid: true }; // Optional field
  }

  const trimmed = certificateNumber.trim();
  
  // Certificate number should be alphanumeric with optional dashes, underscores, or spaces
  // Length: typically 3-50 characters
  if (trimmed.length < 3) {
    return {
      valid: false,
      message: 'Certificate number must be at least 3 characters long.'
    };
  }

  if (trimmed.length > 50) {
    return {
      valid: false,
      message: 'Certificate number cannot exceed 50 characters.'
    };
  }

  // Allow alphanumeric, dashes, underscores, spaces, and forward slashes
  const certificatePattern = /^[A-Za-z0-9\-\s_/]+$/;
  if (!certificatePattern.test(trimmed)) {
    return {
      valid: false,
      message: 'Certificate number can only contain letters, numbers, dashes, spaces, underscores, and forward slashes.'
    };
  }

  return { valid: true };
}

/**
 * Validate phone number format
 * Supports international formats
 */
export function validatePhoneNumber(phone: string | null | undefined): ValidationResult {
  if (!phone || phone.trim() === '') {
    return { valid: true }; // Optional field
  }

  const trimmed = phone.trim();
  
  // Remove common formatting characters for validation
  const cleaned = trimmed.replace(/[\s\-\(\)\.]/g, '');
  
  // Check if it starts with + for international format
  const isInternational = cleaned.startsWith('+');
  
  // Basic validation: 10-15 digits (with optional + prefix)
  const phonePattern = isInternational 
    ? /^\+[1-9]\d{9,14}$/  // International: + followed by 10-15 digits
    : /^[1-9]\d{9,14}$/;   // Domestic: 10-15 digits
  
  if (!phonePattern.test(cleaned)) {
    return {
      valid: false,
      message: 'Please enter a valid phone number (10-15 digits, optional + prefix for international).'
    };
  }

  return { valid: true };
}

/**
 * Validate email format
 */
export function validateEmail(email: string | null | undefined): ValidationResult {
  if (!email || email.trim() === '') {
    return { valid: true }; // Optional field
  }

  const trimmed = email.trim();
  
  // RFC 5322 compliant email regex (simplified)
  const emailPattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!emailPattern.test(trimmed)) {
    return {
      valid: false,
      message: VALIDATION_MESSAGES.INVALID_EMAIL
    };
  }

  // Check length
  if (trimmed.length > 254) {
    return {
      valid: false,
      message: 'Email address cannot exceed 254 characters.'
    };
  }

  return { valid: true };
}

/**
 * Validate required field
 */
export function validateRequired(value: string | number | null | undefined, fieldName: string): ValidationResult {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    return {
      valid: false,
      message: `${fieldName} is required.`
    };
  }
  return { valid: true };
}

/**
 * Validate text length
 */
export function validateTextLength(
  value: string | null | undefined, 
  minLength: number, 
  maxLength: number, 
  fieldName: string
): ValidationResult {
  if (!value) {
    return { valid: true }; // Optional field
  }

  const trimmed = value.trim();
  
  if (trimmed.length < minLength) {
    return {
      valid: false,
      message: `${fieldName} must be at least ${minLength} characters long.`
    };
  }

  if (trimmed.length > maxLength) {
    return {
      valid: false,
      message: `${fieldName} cannot exceed ${maxLength} characters.`
    };
  }

  return { valid: true };
}

/**
 * Validate book number format
 */
export function validateBookNumber(bookNumber: string | null | undefined): ValidationResult {
  if (!bookNumber || bookNumber.trim() === '') {
    return { valid: true }; // Optional field
  }

  const trimmed = bookNumber.trim();
  
  // Book number should be alphanumeric, typically 1-20 characters
  if (trimmed.length > 20) {
    return {
      valid: false,
      message: 'Book number cannot exceed 20 characters.'
    };
  }

  // Allow alphanumeric and common separators
  const bookPattern = /^[A-Za-z0-9\-\s_/]+$/;
  if (!bookPattern.test(trimmed)) {
    return {
      valid: false,
      message: 'Book number can only contain letters, numbers, dashes, spaces, underscores, and forward slashes.'
    };
  }

  return { valid: true };
}

/**
 * Validate page number format
 */
export function validatePageNumber(pageNumber: string | null | undefined): ValidationResult {
  if (!pageNumber || pageNumber.trim() === '') {
    return { valid: true }; // Optional field
  }

  const trimmed = pageNumber.trim();
  
  // Page number should be numeric or alphanumeric, typically 1-10 characters
  if (trimmed.length > 10) {
    return {
      valid: false,
      message: 'Page number cannot exceed 10 characters.'
    };
  }

  // Allow numeric and alphanumeric with optional separators
  const pagePattern = /^[A-Za-z0-9\-\s_/]+$/;
  if (!pagePattern.test(trimmed)) {
    return {
      valid: false,
      message: 'Page number can only contain letters, numbers, dashes, spaces, underscores, and forward slashes.'
    };
  }

  return { valid: true };
}

