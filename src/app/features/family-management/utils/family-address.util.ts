import { Family } from '@core/models/family.model';

export function formatFamilyAddress(family: Family | null | undefined): string | null {
  if (!family) {
    return null;
  }
  const parts = [
    family.address_line_1,
    family.address_line_2,
    family.city,
    family.state?.name,
    family.postal_code
  ].filter((p) => !!p && String(p).trim());
  return parts.length ? parts.join(', ') : null;
}
