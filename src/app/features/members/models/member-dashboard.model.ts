export type MemberAgeBandKey =
  | 'babies'
  | 'children'
  | 'teenagers'
  | 'young_adults'
  | 'adults'
  | 'seniors'
  | 'unknown';

export interface MemberAgeGroup {
  label: string;
  min: number | null;
  max: number | null;
  count: number;
  percent: number;
}

export interface MemberDashboardSummary {
  statistics: {
    total_families: number;
    active_families: number;
    total_members: number;
    active_members: number;
    members_created_this_month: number;
    families_with_bcc?: number;
    families_without_bcc?: number;
  };
  demographics: {
    total: number;
    gender: Record<string, { count: number; percent: number }>;
    age_groups: Record<MemberAgeBandKey, MemberAgeGroup>;
  };
  celebrations: {
    week_label: string;
    week_start: string;
    week_end: string;
    birthdays_count: number;
    anniversaries_count: number;
  };
}

export interface MemberAgeChartSlice {
  key: MemberAgeBandKey;
  /** Short band name from API (e.g. Babies). */
  label: string;
  /** User-facing label with age range (e.g. Babies (Age 0–2)). */
  displayLabel: string;
  count: number;
  percent: number;
}
