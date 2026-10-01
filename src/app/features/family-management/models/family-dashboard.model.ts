export interface FamilyDashboardCountPercent {
  count: number;
  percent: number;
}

export interface FamilyDashboardAgeGroup {
  label: string;
  min: number | null;
  max: number | null;
  count: number;
  percent: number;
}

export interface FamilyDashboardTextValue {
  key: string;
  label: string;
  count: number;
  percent: number;
}

export interface FamilyDashboardSeriesPoint {
  period: string;
  count: number;
}

export interface FamilyDashboardRecentFamily {
  id: string;
  family_name: string;
  family_code: string;
  created_at: string | null;
}

export interface FamilyDashboardBccRow {
  bcc_id: string;
  name: string;
  families: number;
  people: number;
  average_family_size: number;
  active_families: number;
}

export interface FamilyDashboardLocationRow {
  city: string;
  city_key: string;
  families: number;
  percent: number;
}

export interface FamilyDashboardSummary {
  filters: {
    bcc_id: string | null;
    status: string | null;
    period: string;
    from: string;
    to: string;
  };
  definitions: Record<string, string>;
  population: {
    total_families: number;
    active_families: number;
    inactive_families: number;
    migrated_families: number;
    total_people: number;
    active_people: number;
    inactive_people: number;
    deceased_people: number;
    migrated_people: number;
    families_with_members: number;
    families_without_members: number;
  };
  kpis: {
    total_families: number;
    total_people: number;
    active_families: number;
    active_people: number;
    new_families: number;
    average_family_size: number;
    active_families_percent: number;
    active_people_percent: number;
  };
  attention: {
    no_active_head: number;
    no_contact: number;
    no_address: number;
    no_members: number;
    missing_dob: number;
    missing_gender: number;
    missing_relationship: number;
  };
  demographics: {
    age_groups: Record<string, FamilyDashboardAgeGroup>;
    gender: Record<string, FamilyDashboardCountPercent>;
    with_dob: number;
    without_dob: number;
    with_gender: number;
    without_gender: number;
    under_18: number;
    under_18_insight: string | null;
  };
  household: {
    bands: Record<string, FamilyDashboardCountPercent>;
    average: number;
    families_with_members: number;
    families_without_members: number;
    have_under_18: number;
    have_seniors: number;
    multiple_adults: number;
    no_active_head: number;
    head_gender: Record<string, number>;
  };
  growth: {
    families: FamilyDashboardSeriesPoint[];
    members: FamilyDashboardSeriesPoint[];
    recent_families: FamilyDashboardRecentFamily[];
    caption: string;
  };
  bcc: FamilyDashboardBccRow[];
  locations: FamilyDashboardLocationRow[];
  background: {
    occupation: {
      recorded: number;
      not_recorded: number;
      unclassified?: number;
      total: number;
      categories?: Array<{ key: string; label: string }>;
      values: FamilyDashboardTextValue[];
      definition?: string;
    };
    education: {
      recorded: number;
      not_recorded: number;
      excluded?: number;
      total: number;
      values: FamilyDashboardTextValue[];
      definition?: string;
    };
  };
  data_quality: {
    family_profile: {
      complete_count: number;
      incomplete_count: number;
      percent: number;
      definition: string;
    };
    members: {
      missing_dob: number;
      missing_gender: number;
      missing_relationship: number;
      total: number;
    };
  };
  contributions?: {
    families_with_payment_in_period: number;
    families_with_outstanding: number;
    families_with_no_successful_payment_lifetime: number;
    period_collected: string | number;
    currency_code: string;
    definitions: Record<string, string>;
  };
  pastoral?: {
    error: string | null;
    baptized_without_communion: number | null;
    baptized_without_confirmation: number | null;
  };
  meta: {
    generated_at: string;
    cached: boolean;
  };
}
