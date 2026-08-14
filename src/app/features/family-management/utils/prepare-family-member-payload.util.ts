import { FamilyMember } from '@core/models/family.model';
import { FamilyMemberFormValue } from '../components/family-member-form-modal/family-member-form-modal.component';

export function formatPhoneForApi(
  raw: string | null | undefined,
  callingCode: string
): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }

  const trimmed = String(raw).trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('+')) {
    const compact = `+${trimmed.slice(1).replace(/\D/g, '')}`;
    return compact.length > 1 ? (compact.length > 20 ? compact.slice(0, 20) : compact) : null;
  }

  const digits = trimmed.replace(/\D/g, '');
  if (!digits) {
    return null;
  }

  const dialCodeRaw = (callingCode || '').trim();
  const dialCode = dialCodeRaw.startsWith('+') ? dialCodeRaw : `+${dialCodeRaw}`;
  const dialDigits = dialCode.replace(/\D/g, '');

  let formatted: string;
  if (!dialDigits) {
    formatted = dialCode.startsWith('+') ? `${dialCode}${digits}` : `+${digits}`;
  } else if (digits.startsWith(dialDigits)) {
    formatted = `+${digits}`;
  } else {
    formatted = `${dialCode}${digits}`;
  }

  return formatted.length > 20 ? formatted.slice(0, 20) : formatted;
}

export function prepareFamilyMemberPayload(
  value: FamilyMemberFormValue,
  callingCode: string
): Record<string, unknown> {
  const sanitize = (input: string | null | undefined): string | null => {
    if (input === null || input === undefined) {
      return null;
    }
    const trimmed = String(input).trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const normalizeLower = (input: string | null | undefined): string | null => {
    const sanitized = sanitize(input);
    return sanitized ? sanitized.toLowerCase() : null;
  };

  const normalizeChurchType = (input: string | null | undefined): 'home_parish' | 'other' | null => {
    if (!input) {
      return null;
    }
    const normalized = input.toLowerCase().trim();
    return normalized === 'other' ? 'other' : normalized === 'home_parish' ? 'home_parish' : null;
  };

  return {
    person_id: value.person_id || undefined,
    first_name: (value.first_name || '').trim(),
    middle_name: sanitize(value.middle_name),
    last_name: (value.last_name || '').trim(),
    date_of_birth: sanitize(value.date_of_birth),
    gender: normalizeLower(value.gender) as FamilyMember['gender'],
    relationship_to_head: (normalizeLower(value.relationship_to_head) || 'other') as FamilyMember['relationship_to_head'],
    marital_status: normalizeLower(value.marital_status) as FamilyMember['marital_status'],
    phone: formatPhoneForApi(value.phone, callingCode),
    email: sanitize(value.email),
    occupation: sanitize(value.occupation),
    education: sanitize(value.education),
    baptism_date: sanitize(value.baptism_date),
    baptism_place: sanitize(value.baptism_place),
    baptism_godparent_primary: sanitize(value.baptism_godparent_primary),
    baptism_godparent_secondary: sanitize(value.baptism_godparent_secondary),
    baptism_location_type: normalizeChurchType(value.baptism_location_type),
    baptism_church_name: sanitize(value.baptism_church_name),
    baptism_church_address: sanitize(value.baptism_church_address),
    baptism_priest_name: sanitize(value.baptism_priest_name),
    baptism_priest_is_home:
      value.baptism_priest_is_home === null || value.baptism_priest_is_home === undefined
        ? null
        : !!value.baptism_priest_is_home,
    first_communion_date: sanitize(value.first_communion_date),
    first_communion_place: sanitize(value.first_communion_place),
    confirmation_date: sanitize(value.confirmation_date),
    confirmation_place: sanitize(value.confirmation_place),
    marriage_date: sanitize(value.marriage_date),
    marriage_place: sanitize(value.marriage_place),
    marriage_spouse_name: sanitize(value.marriage_spouse_name),
    marriage_bride_full_name: sanitize(value.marriage_bride_full_name),
    marriage_bride_address: sanitize(value.marriage_bride_address),
    marriage_bride_church_type: normalizeChurchType(value.marriage_bride_church_type),
    marriage_bride_church_name: sanitize(value.marriage_bride_church_name),
    marriage_bride_church_address: sanitize(value.marriage_bride_church_address),
    marriage_groom_full_name: sanitize(value.marriage_groom_full_name),
    marriage_groom_address: sanitize(value.marriage_groom_address),
    marriage_groom_church_type: normalizeChurchType(value.marriage_groom_church_type),
    marriage_groom_church_name: sanitize(value.marriage_groom_church_name),
    marriage_groom_church_address: sanitize(value.marriage_groom_church_address),
    status: (normalizeLower(value.status) || 'active') as FamilyMember['status']
  };
}

export function extractMemberApiError(error: unknown, fallback: string): string {
  const err = error as {
    error?: { message?: string; error?: string; errors?: Record<string, string | string[]> };
    message?: string;
  };

  if (err?.error?.errors && typeof err.error.errors === 'object') {
    const messages = Object.values(err.error.errors).flatMap((entry) =>
      Array.isArray(entry) ? entry : [entry]
    );
    const first = messages.find((m) => typeof m === 'string' && m.trim().length > 0);
    if (first) {
      return first;
    }
  }

  const detail = err?.error?.error?.trim();
  if (detail) {
    return detail;
  }

  const message = err?.error?.message?.trim() || err?.message?.trim();
  return message || fallback;
}

/** True when the API reports a successful member create/update (data may still be absent). */
export function isMemberApiSuccess(res: unknown): boolean {
  if (!res || typeof res !== 'object') {
    return false;
  }
  const body = res as Record<string, unknown>;
  if (body['success'] === true || body['success'] === 1) {
    return true;
  }
  if (body['success'] === false || body['success'] === 0) {
    return false;
  }
  // Some endpoints may return the member record without an envelope.
  return typeof body['id'] === 'string' && !!(body['first_name'] ?? body['last_name']);
}

export function getMemberApiData<T extends { id?: string }>(res: unknown): T | null {
  if (!res || typeof res !== 'object') {
    return null;
  }
  const body = res as Record<string, unknown>;
  const data = body['data'];
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data as T;
  }
  if (typeof body['id'] === 'string') {
    return body as T;
  }
  return null;
}

export function getMemberApiMessage(res: unknown, fallback: string): string {
  if (res && typeof res === 'object') {
    const message = (res as { message?: string }).message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return message.trim();
    }
  }
  return fallback;
}
