/** Demographics chart palettes — scoped to Sacraments dashboard Demographics row. */

export interface DemographicsColorToken {
  cssVar: string;
  fallback: string;
}

export const DEMOGRAPHICS_SCOPE_CLASS = 'sacraments-dashboard__demographics-analytics';

export const MEMBER_STATUS_COLORS = {
  parish: { cssVar: '--cf-demo-member-parish', fallback: '#0d9488' },
  visitor: { cssVar: '--cf-demo-member-visitor', fallback: '#b45309' },
  unknown: { cssVar: '--cf-demo-member-unknown', fallback: '#64748b' },
} satisfies Record<string, DemographicsColorToken>;

export const GENDER_COLORS = {
  male: { cssVar: '--cf-demo-gender-male', fallback: '#16a34a' },
  female: { cssVar: '--cf-demo-gender-female', fallback: '#ea580c' },
  other: { cssVar: '--cf-demo-gender-other', fallback: '#d97706' },
  unknown: { cssVar: '--cf-demo-gender-unknown', fallback: '#64748b' },
} satisfies Record<string, DemographicsColorToken>;

/** Distinct warm/semantic hues for age distribution multi-series charts. */
export const STANDARD_DASHBOARD_CHART_EXCLUDED_TYPE_CODES = new Set(['RECONCILIATION', 'ANOINTING']);

export function isIncludedInStandardDashboardChart(code: string | null | undefined): boolean {
  if (!code?.trim()) {
    return false;
  }

  const normalized = code.trim().toUpperCase().replace(/[\s-]+/g, '_');
  return !STANDARD_DASHBOARD_CHART_EXCLUDED_TYPE_CODES.has(normalized);
}

/** @deprecated Use isIncludedInStandardDashboardChart */
export const AGE_DISTRIBUTION_EXCLUDED_TYPE_CODES = STANDARD_DASHBOARD_CHART_EXCLUDED_TYPE_CODES;

export function isIncludedInAgeDistribution(code: string | null | undefined): boolean {
  return isIncludedInStandardDashboardChart(code);
}

export const SACRAMENT_SERIES_COLORS: DemographicsColorToken[] = [
  { cssVar: '--cf-demo-series-1', fallback: '#16a34a' },
  { cssVar: '--cf-demo-series-2', fallback: '#ea580c' },
  { cssVar: '--cf-demo-series-3', fallback: '#dc2626' },
  { cssVar: '--cf-demo-series-4', fallback: '#d97706' },
  { cssVar: '--cf-demo-series-5', fallback: '#0d9488' },
  { cssVar: '--cf-demo-series-6', fallback: '#65a30d' },
  { cssVar: '--cf-demo-series-7', fallback: '#e11d48' },
  { cssVar: '--cf-demo-series-8', fallback: '#f97316' },
  { cssVar: '--cf-demo-series-9', fallback: '#ca8a04' },
  { cssVar: '--cf-demo-series-10', fallback: '#9333ea' },
];

/** Sequential amber scale — communicates age distribution / range. */
export const AGE_DISTRIBUTION_COLORS: DemographicsColorToken[] = [
  { cssVar: '--cf-demo-age-1', fallback: '#fde68a' },
  { cssVar: '--cf-demo-age-2', fallback: '#fbbf24' },
  { cssVar: '--cf-demo-age-3', fallback: '#f59e0b' },
  { cssVar: '--cf-demo-age-4', fallback: '#d97706' },
  { cssVar: '--cf-demo-age-5', fallback: '#b45309' },
  { cssVar: '--cf-demo-age-6', fallback: '#92400e' },
];

export function resolveDemographicsScope(element?: Element | null): Element {
  if (typeof document === 'undefined') {
    return {} as Element;
  }

  return element?.closest(`.${DEMOGRAPHICS_SCOPE_CLASS}`) ?? document.documentElement;
}

export function resolveDemographicsColor(
  token: DemographicsColorToken,
  scope?: Element | null,
): string {
  if (typeof document === 'undefined' || !scope) {
    return token.fallback;
  }

  const value = getComputedStyle(scope).getPropertyValue(token.cssVar).trim();
  return value || token.fallback;
}

export function resolveAgeBucketColor(index: number, scope?: Element | null): string {
  const token = AGE_DISTRIBUTION_COLORS[index % AGE_DISTRIBUTION_COLORS.length];
  return resolveDemographicsColor(token, scope);
}

export function resolveSacramentSeriesColor(index: number, scope?: Element | null): string {
  const token = SACRAMENT_SERIES_COLORS[index % SACRAMENT_SERIES_COLORS.length];
  return resolveDemographicsColor(token, scope);
}
