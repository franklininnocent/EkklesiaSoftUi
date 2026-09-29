import { Sacrament } from '@features/settings/sacraments/models/sacrament.model';
import { SacramentTypeDto } from '@core/services/sacrament-type-lookup.service';
import { FamilyMember } from '@core/models/family.model';
import {
  isSacramentCompleted,
  resolveCanonicalSacrament,
  SacramentTypeLike
} from './sacrament-completion.util';

export function registerStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'registered':
    case 'active':
      return 'Registered';
    case 'conditional':
      return 'Conditional';
    case 'voided':
    case 'cancelled':
      return 'Voided';
    default:
      return status ? status.charAt(0).toUpperCase() + status.slice(1) : '—';
  }
}

export function registerRegistrySummary(record: Sacrament): string {
  const parts: string[] = [];
  if (record.book_number?.trim()) {
    parts.push(`Book ${record.book_number.trim()}`);
  }
  if (record.page_number?.trim()) {
    parts.push(`Page ${record.page_number.trim()}`);
  }
  return parts.length ? parts.join(' · ') : '—';
}

export function sacramentTypeMatchesRecord(
  type: SacramentTypeDto,
  record: Sacrament
): boolean {
  if (type.id != null && record.sacrament_type_id === type.id) {
    return true;
  }

  const canonicalType = resolveCanonicalSacrament(type.code);
  const recordCode = record.sacrament_type?.code ?? '';
  const canonicalRecord = resolveCanonicalSacrament(recordCode);

  return canonicalType !== null && canonicalType === canonicalRecord;
}

export function pickRegisterRecordForType(
  records: Sacrament[],
  type: SacramentTypeDto
): Sacrament | null {
  const matches = records.filter((record) => sacramentTypeMatchesRecord(type, record));
  if (matches.length === 0) {
    return null;
  }

  return matches.reduce((latest, current) => {
    const latestDate = latest.date_administered ?? '';
    const currentDate = current.date_administered ?? '';
    if (!latestDate) {
      return current;
    }
    if (!currentDate) {
      return latest;
    }
    return currentDate > latestDate ? current : latest;
  });
}

export function isSacramentOnRecord(
  member: FamilyMember | null | undefined,
  code: string,
  registerRecord: Sacrament | null | undefined
): boolean {
  if (registerRecord) {
    return true;
  }
  return isSacramentCompleted(member, code);
}

export function countSacramentsOnRecord(
  member: FamilyMember | null | undefined,
  sacramentTypes: SacramentTypeLike[],
  registerRecords: Sacrament[]
): number {
  if (!member || sacramentTypes.length === 0) {
    return 0;
  }

  return sacramentTypes.reduce((count, type) => {
    const registerRecord = pickRegisterRecordForType(registerRecords, type as SacramentTypeDto);
    return isSacramentOnRecord(member, type.code, registerRecord) ? count + 1 : count;
  }, 0);
}

export function buildRegisterDisplayFields(
  record: Sacrament
): Array<{ label: string; value: string }> {
  const minister = [record.minister_title?.trim(), record.minister_name?.trim()]
    .filter(Boolean)
    .join(' ')
    .trim();

  const rows: Array<{ label: string; value: string | null | undefined; always?: boolean }> = [
    { label: 'Received', value: record.date_administered, always: true },
    { label: 'Place', value: record.place_administered },
    { label: 'Minister', value: minister || record.minister_name },
    { label: 'Register', value: registerRegistrySummary(record) },
    { label: 'Certificate', value: record.certificate_number }
  ];

  return rows
    .filter((row) => row.always || row.value?.trim())
    .map((row) => ({
      label: row.label,
      value: row.label === 'Received' ? formatRegisterDate(row.value) : row.value?.trim() ?? '—'
    }));
}

export function formatRegisterDate(date: string | null | undefined): string {
  if (!date) {
    return '—';
  }
  try {
    const parsed = new Date(date);
    return isNaN(parsed.getTime())
      ? '—'
      : parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return '—';
  }
}
