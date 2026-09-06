export interface SacramentDashboardParams {
  date_from?: string;
  date_to?: string;
  bcc_id?: string;
  include_gaps?: boolean;
  include_marriage_gaps?: boolean;
}

export interface SacramentDashboardTypeKpi {
  sacrament_type_id: number;
  code: string;
  label: string;
  period: number;
  all_time: number;
  yoy_pct: number;
}

export interface SacramentDashboardTypeTotal {
  code: string;
  label: string;
  count: number;
}

export interface SacramentDashboardTrendPoint {
  period: string;
  label: string;
  count: number;
}

export interface SacramentDashboardTrendSeries {
  code: string;
  label: string;
  points: SacramentDashboardTrendPoint[];
}

export interface SacramentDashboardRecentRecord {
  id: number;
  recipient_name: string;
  date_administered: string;
  place_administered?: string;
  status: string;
  type: {
    id: number;
    name: string;
    code: string;
  };
}

export interface SacramentDashboardGenderByType {
  code: string;
  label: string;
  sacrament_type_id: number;
  male: number;
  female: number;
  other: number;
  unknown: number;
}

export interface SacramentDashboardAgeBucket {
  key: string;
  label: string;
  count: number;
}

export interface SacramentDashboardAgeByType {
  code: string;
  label: string;
  sacrament_type_id: number;
  with_age_data: number;
  average_age: number | null;
  min_age: number | null;
  max_age: number | null;
  buckets: SacramentDashboardAgeBucket[];
}

export interface SacramentDashboardDemographics {
  gender_by_type: SacramentDashboardGenderByType[];
  age_by_type: SacramentDashboardAgeByType[];
  age_buckets: SacramentDashboardAgeBucket[];
}

export interface MarriageMetricRing {
  count: number;
  pct: number;
}

export interface MarriageCanonicalBreakdown {
  total_recorded: number;
  metrics: {
    catholic_both: MarriageMetricRing;
    mixed_disparity: MarriageMetricRing;
    same_parish: MarriageMetricRing;
    inter_parish: MarriageMetricRing;
  };
}

export type MarriageRegisterFilterKey = keyof MarriageCanonicalBreakdown['metrics'];

export interface SacramentDashboardMatrimony {
  count: number;
  sacrament_type_id: number;
  bride_avg_age: number | null;
  groom_avg_age: number | null;
  bride_min_age: number | null;
  bride_max_age: number | null;
  groom_min_age: number | null;
  groom_max_age: number | null;
  age_brackets: {
    bride: SacramentDashboardAgeBucket[];
    groom: SacramentDashboardAgeBucket[];
  };
  parish_origins: Array<{
    parish: string;
    role: 'bride' | 'groom' | string;
    count: number;
  }>;
  inter_parish_count: number;
  canonical_classification: Record<string, number>;
  bride_with_age?: number;
  groom_with_age?: number;
  bride_missing_dob?: number;
  groom_missing_dob?: number;
  canonical_breakdown?: MarriageCanonicalBreakdown;
}

export interface SacramentDashboardGapSacrament {
  code: string;
  label: string;
  sacrament_type_id: number;
  eligible_count: number;
  received_count: number;
  missing_count: number;
  participation_pct: number;
  missing_age_buckets: SacramentDashboardAgeBucket[];
}

export interface SacramentDashboardGaps {
  eligible_members: number;
  thresholds: {
    eucharist: number;
    progression: number;
    confirmation: number;
    matrimony: number;
  };
  by_sacrament: SacramentDashboardGapSacrament[];
  progression: {
    baptized_without_communion: {
      count: number;
      eligible_count: number;
    };
    baptized_without_confirmation: {
      count: number;
      eligible_count: number;
    };
    female_unmarried_over_18: {
      count: number;
      eligible_count: number;
    };
    male_unmarried_over_23: {
      count: number;
      eligible_count: number;
    };
  };
}

export interface SacramentDashboardSummary {
  period: {
    date_from: string;
    date_to: string;
    label: string;
  };
  kpis: {
    total_period: number;
    total_all_time: number;
    this_month: number;
    monthly_average: number;
    yoy_growth_pct: number;
    by_type: SacramentDashboardTypeKpi[];
  };
  trends: {
    granularity: string;
    start: string;
    end: string;
    series: SacramentDashboardTrendSeries[];
  };
  breakdowns: {
    member_status: {
      member: number;
      non_member: number;
      unknown: number;
    };
    by_type_totals: SacramentDashboardTypeTotal[];
  };
  demographics: SacramentDashboardDemographics;
  matrimony: SacramentDashboardMatrimony | null;
  gaps?: SacramentDashboardGaps;
  recent: SacramentDashboardRecentRecord[];
  meta: {
    restricted_types_excluded: string[];
    generated_at: string;
    duration_ms?: number;
    cached?: boolean;
  };
}

export interface SacramentDashboardResponse {
  success: boolean;
  data: SacramentDashboardSummary;
  message?: string;
}
