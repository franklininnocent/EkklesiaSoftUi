import {
  MemberAgeBandKey,
  MemberAgeChartSlice,
  MemberAgeGroup,
} from '../models/member-dashboard.model';

/** Display order for parish member age bands (matches API / BccAgeBands). */
export const MEMBER_AGE_BAND_ORDER: MemberAgeBandKey[] = [
  'babies',
  'children',
  'teenagers',
  'young_adults',
  'adults',
  'seniors',
  'unknown',
];

/** Professional palette — green, orange, blue, yellow, plus supporting hues. */
export const MEMBER_AGE_BAND_COLORS: Record<MemberAgeBandKey, string> = {
  babies: '#eab308',
  children: '#16a34a',
  teenagers: '#2563eb',
  young_adults: '#ea580c',
  adults: '#0d9488',
  seniors: '#7c3aed',
  unknown: '#64748b',
};

/**
 * Formats the age span for a band, e.g. "Age 0–2", "Age 60+", or null for unknown.
 */
export function memberAgeRangeLabel(min: number | null, max: number | null): string | null {
  if (min === null && max === null) {
    return null;
  }
  if (min !== null && max !== null) {
    return `Age ${min}–${max}`;
  }
  if (min !== null && max === null) {
    return `Age ${min}+`;
  }

  return max !== null ? `Age 0–${max}` : null;
}

/** e.g. Babies (Age 0–2), Unknown (no range suffix). */
export function memberAgeGroupDisplayLabel(
  label: string,
  min: number | null,
  max: number | null
): string {
  const range = memberAgeRangeLabel(min, max);
  if (!range) {
    return label;
  }

  return `${label} (${range})`;
}

export function memberAgeChartSlices(
  ageGroups: Record<string, MemberAgeGroup> | null | undefined
): MemberAgeChartSlice[] {
  if (!ageGroups) {
    return [];
  }

  return MEMBER_AGE_BAND_ORDER.map((key) => {
    const row = ageGroups[key];
    const shortLabel = row?.label ?? key;
    const min = row?.min ?? null;
    const max = row?.max ?? null;
    return {
      key,
      label: shortLabel,
      displayLabel: memberAgeGroupDisplayLabel(shortLabel, min, max),
      count: row?.count ?? 0,
      percent: row?.percent ?? 0,
    };
  }).filter((slice) => slice.count > 0);
}

export function memberAgeColor(key: MemberAgeBandKey): string {
  return MEMBER_AGE_BAND_COLORS[key] ?? '#64748b';
}

export function isMemberAgeBandKey(value: string | null | undefined): value is MemberAgeBandKey {
  return value != null && (MEMBER_AGE_BAND_ORDER as readonly string[]).includes(value);
}

export const MEMBER_AGE_BAND_BOUNDS: Record<
  MemberAgeBandKey,
  { label: string; min: number | null; max: number | null }
> = {
  babies: { label: 'Babies', min: 0, max: 2 },
  children: { label: 'Children', min: 3, max: 12 },
  teenagers: { label: 'Teenagers', min: 13, max: 17 },
  young_adults: { label: 'Young adults', min: 18, max: 25 },
  adults: { label: 'Adults', min: 26, max: 59 },
  seniors: { label: 'Seniors', min: 60, max: null },
  unknown: { label: 'Unknown', min: null, max: null },
};

export function memberAgeBandFilterLabel(key: MemberAgeBandKey): string {
  const band = MEMBER_AGE_BAND_BOUNDS[key];
  return memberAgeGroupDisplayLabel(band.label, band.min, band.max);
}
