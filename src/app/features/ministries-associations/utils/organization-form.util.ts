import { AbstractControl, FormBuilder, ValidationErrors, Validators } from '@angular/forms';

/**
 * Organization create/edit form group factory.
 *
 * Extracted so the "Add organization" page and the organization detail
 * page's inline "Edit profile" form share one FormGroup shape/validator
 * set instead of two hand-duplicated copies. Behavior is unchanged from
 * the original per-page definitions.
 */
export function todayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function notFutureDateValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim();
  if (!value) {
    return null;
  }
  if (value > todayIsoDate()) {
    return { futureDate: true };
  }
  return null;
}

export function createOrganizationFormGroup(fb: FormBuilder) {
  return fb.nonNullable.group({
    code: [
      '',
      [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(50),
        Validators.pattern(/^[a-zA-Z0-9-]+$/),
      ],
    ],
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(255)]],
    short_name: ['', Validators.maxLength(50)],
    category_id: ['', Validators.required],
    type_id: ['', Validators.required],
    description: [''],
    vision: [''],
    mission: [''],
    objectives: [''],
    patron_saint: ['', Validators.maxLength(150)],
    established_date: ['', notFutureDateValidator],
    theme_color: ['', Validators.pattern(/^$|^#[0-9A-Fa-f]{6}$/)],
    email: ['', [Validators.email, Validators.maxLength(255)]],
    phone: ['', Validators.maxLength(20)],
    website: ['', Validators.maxLength(500)],
    facebook: ['', Validators.maxLength(500)],
    instagram: ['', Validators.maxLength(500)],
    whatsapp: ['', Validators.maxLength(500)],
    youtube: ['', Validators.maxLength(500)],
    telegram: ['', Validators.maxLength(500)],
    status: ['active' as 'active' | 'inactive'],
    allow_multi_role_holding: [false],
    guests_can_hold_office: [false],
  });
}

export type OrganizationFormGroup = ReturnType<typeof createOrganizationFormGroup>;

export function mapOrganizationFieldMessage(field: string, message: string): string {
  const lower = message.toLowerCase();
  const isDuplicate = lower.includes('unique') || lower.includes('taken') || lower.includes('already');
  if (field === 'code' && isDuplicate) {
    return 'This code is already used.';
  }
  if (field === 'name' && isDuplicate) {
    return 'This name is already used.';
  }
  return message;
}
