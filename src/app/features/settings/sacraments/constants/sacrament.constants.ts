/**
 * Sacrament Constants
 * Centralized constants and enums for the Sacraments module
 */

/**
 * Sacrament Status Enum
 */
export enum SacramentStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  CONDITIONAL = 'conditional'
}

/**
 * Sacrament Status Options for UI
 */
export const SACRAMENT_STATUS_OPTIONS = [
  { value: SacramentStatus.ACTIVE, label: 'Active' },
  { value: SacramentStatus.CANCELLED, label: 'Cancelled' },
  { value: SacramentStatus.CONDITIONAL, label: 'Conditional' }
] as const;

/**
 * Gender Options
 */
export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other'
}

/**
 * Gender Options for UI
 */
export const GENDER_OPTIONS = [
  { value: Gender.MALE, label: 'Male' },
  { value: Gender.FEMALE, label: 'Female' },
  { value: Gender.OTHER, label: 'Other' }
] as const;

/**
 * Church Type Options
 */
export enum ChurchType {
  HOME_PARISH = 'home_parish',
  OTHER = 'other'
}

/**
 * Family Selection Type
 */
export enum FamilySelectionType {
  NONE = 'none',
  EXISTING = 'existing',
  NEW = 'new'
}

/**
 * Default Form Values
 */
export const DEFAULT_SACRAMENT_FORM = {
  sacrament_type_id: undefined,
  recipient_name: '',
  date_administered: '',
  place_administered: '',
  minister_name: '',
  minister_title: '',
  certificate_number: '',
  book_number: '',
  page_number: '',
  recipient_birth_date: '',
  recipient_birth_place: '',
  recipient_gender: undefined,
  father_name: '',
  mother_name: '',
  godparent1_name: '',
  godparent2_name: '',
  witnesses: '',
  notes: '',
  status: SacramentStatus.ACTIVE,
  marriage_bride_full_name: '',
  marriage_bride_father_name: '',
  marriage_bride_mother_name: '',
  marriage_bride_address: '',
  marriage_bride_church_type: ChurchType.HOME_PARISH,
  marriage_bride_church_name: '',
  marriage_bride_church_address: '',
  marriage_groom_full_name: '',
  marriage_groom_father_name: '',
  marriage_groom_mother_name: '',
  marriage_groom_address: '',
  marriage_groom_church_type: ChurchType.HOME_PARISH,
  marriage_groom_church_name: '',
  marriage_groom_church_address: ''
} as const;

/**
 * Pagination Defaults
 */
export const PAGINATION_DEFAULTS = {
  DEFAULT_PAGE: 1,
  DEFAULT_PER_PAGE: 20,
  PAGE_SIZE_OPTIONS: [10, 20, 30, 50, 100] as const
} as const;

/**
 * Date Validation
 */
export const DATE_VALIDATION = {
  MAX_FUTURE_DAYS: 1, // Allow 1 day in future for corrections
  DATE_FORMAT: 'YYYY-MM-DD',
  DISPLAY_FORMAT: 'MMM d, y'
} as const;

/**
 * Form Validation Messages
 */
export const VALIDATION_MESSAGES = {
  REQUIRED: 'This field is required',
  INVALID_DATE: 'Please enter a valid date',
  FUTURE_DATE: 'The date cannot be more than 1 day in the future',
  INVALID_EMAIL: 'Please enter a valid email address',
  INVALID_PHONE: 'Please enter a valid phone number',
  DUPLICATE_CERTIFICATE: 'This certificate number already exists',
  BRIDE_NAME_REQUIRED: 'Please enter the bride\'s full name',
  GROOM_NAME_REQUIRED: 'Please enter the groom\'s full name'
} as const;

