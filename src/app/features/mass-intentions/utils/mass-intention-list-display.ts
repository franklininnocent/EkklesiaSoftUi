import { MassIntentionRecord } from '../services/mass-intentions-api.service';

/** Master category label, or em dash when missing (legacy rows). */
export function massIntentionListType(row: MassIntentionRecord): string {
  if (row.mass_intention_category_id) {
    return row.intention_text?.trim() || '—';
  }

  return '—';
}

/** Specific details; legacy records may only have free text in intention_text. */
export function massIntentionListDescription(row: MassIntentionRecord): string | null {
  const description = row.intention_description?.trim();
  if (description) {
    return description;
  }

  if (!row.mass_intention_category_id) {
    const legacy = row.intention_text?.trim();
    return legacy || null;
  }

  return null;
}

export function massIntentionNeedsCategory(row: MassIntentionRecord): boolean {
  return !row.mass_intention_category_id;
}

/** BCC or Place subtitle for list, view, and export. */
export function massIntentionBeneficiaryIdentification(row: MassIntentionRecord): string | null {
  const bccName = row.beneficiary_bcc?.name?.trim();
  if (bccName) {
    return `BCC · ${bccName}`;
  }
  const place = row.beneficiary_place?.trim();
  if (place) {
    return `Place · ${place}`;
  }
  return null;
}

/** Parish-office friendly scheduled day (falls back to raw ISO date). */
export function formatMassIntentionScheduledDay(isoDate: string | null | undefined): string {
  if (!isoDate) {
    return '—';
  }
  const parsed = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }
  return parsed.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
