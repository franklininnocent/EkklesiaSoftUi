export interface EcclesiasticalAuditEntry {
  action?: string;
  event?: string;
  changes?: unknown;
  new_values?: unknown;
  old_values?: unknown;
}

export interface EcclesiasticalAuditChangeLine {
  label: string;
  text: string;
}

const HIDDEN_AUDIT_FIELDS = new Set([
  'id',
  'created_at',
  'updated_at',
  'deleted_at',
  'normalized_name',
]);

const BISHOP_AUDIT_FIELD_LABELS: Record<string, string> = {
  full_name: 'Full name',
  given_name: 'Given name',
  family_name: 'Family name',
  religious_name: 'Religious name',
  archdiocese_id: 'Diocese',
  ecclesiastical_title_id: 'Title',
  appointed_date: 'Appointed',
  ordained_bishop_date: 'Ordained bishop',
  ordained_priest_date: 'Ordained priest',
  date_of_birth: 'Date of birth',
  email: 'Email',
  phone: 'Phone',
  status: 'Status',
  is_current: 'Current bishop',
  biography: 'Biography',
  photo_url: 'Photo URL',
  photo_path: 'Photo file',
  coat_of_arms_path: 'Coat of arms',
};

export function parseAuditPayload(value: unknown): Record<string, unknown> | null {
  if (value == null) {
    return null;
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  try {
    let parsed: unknown = JSON.parse(value);
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed);
    }
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
}

function fieldLabel(key: string): string {
  return BISHOP_AUDIT_FIELD_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatAuditScalar(value: unknown): string {
  if (value == null || value === '') {
    return '—';
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value !== 'string') {
    return String(value);
  }

  const dateOnly = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2})?/.test(value);
  if (dateOnly) {
    const parsed = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
  }

  if (value === 'active' || value === 'inactive' || value === 'archived') {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  return value;
}

function isDiffEntry(value: unknown): value is { old: unknown; new: unknown } {
  return typeof value === 'object'
    && value !== null
    && 'old' in value
    && 'new' in value;
}

function formatFieldMap(values: Record<string, unknown> | null): EcclesiasticalAuditChangeLine[] {
  if (!values) {
    return [];
  }

  return Object.entries(values)
    .filter(([key]) => !HIDDEN_AUDIT_FIELDS.has(key))
    .map(([key, value]) => ({
      label: fieldLabel(key),
      text: formatAuditScalar(value),
    }));
}

function formatDiffMap(values: Record<string, unknown> | null): EcclesiasticalAuditChangeLine[] {
  if (!values) {
    return [];
  }

  return Object.entries(values)
    .filter(([key]) => !HIDDEN_AUDIT_FIELDS.has(key))
    .map(([key, value]) => {
      if (isDiffEntry(value)) {
        return {
          label: fieldLabel(key),
          text: `${formatAuditScalar(value.old)} → ${formatAuditScalar(value.new)}`,
        };
      }

      return {
        label: fieldLabel(key),
        text: formatAuditScalar(value),
      };
    });
}

export function formatEcclesiasticalAuditChanges(
  entry: EcclesiasticalAuditEntry
): EcclesiasticalAuditChangeLine[] {
  const action = entry.action ?? entry.event ?? 'update';
  const parsedChanges = parseAuditPayload(entry.changes);

  if (parsedChanges && Object.values(parsedChanges).some(isDiffEntry)) {
    return formatDiffMap(parsedChanges);
  }

  if (action === 'create') {
    const lines = formatFieldMap(parseAuditPayload(entry.new_values));
    return lines.length ? lines : [{ label: 'Record', text: 'Created' }];
  }

  if (action === 'delete' || action === 'force_delete') {
    const lines = formatFieldMap(parseAuditPayload(entry.old_values));
    return lines.length ? lines : [{ label: 'Record', text: 'Deleted' }];
  }

  if (parsedChanges) {
    return formatFieldMap(parsedChanges);
  }

  const newValues = parseAuditPayload(entry.new_values);
  if (newValues) {
    return formatFieldMap(newValues);
  }

  return [];
}
