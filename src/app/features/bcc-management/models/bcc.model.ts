export type BccStatus = 'active' | 'inactive' | 'suspended';
export type BccTab = 'overview' | 'members' | 'leadership' | 'member-history' | 'audit';
export type BccAgeBand =
  | 'babies'
  | 'children'
  | 'teenagers'
  | 'young_adults'
  | 'adults'
  | 'seniors'
  | 'unknown';

export interface CountPercent {
  count: number;
  percent: number;
}

export interface BccAgeGroup extends CountPercent {
  label: string;
  min: number | null;
  max: number | null;
}

export type BccDashboardPeriod = '3m' | '6m' | '1y' | '3y';
export type BccAttentionType = 'no_primary' | 'unlinked_families' | 'empty' | 'data_review';
export type BccTrendFilter = 'growing' | 'declining';
export type BccInsightSeverity = 'critical' | 'attention' | 'information';

export interface BccDashboardFilters {
  status?: BccStatus | 'all' | null;
  period?: BccDashboardPeriod | null;
  search?: string | null;
  coordinator?: string | null;
  attention?: BccAttentionType | null;
  trend?: BccTrendFilter | null;
  overview_limit?: number;
}

export interface BccGrowthPoint {
  period: string;
  label: string;
  value: number;
}

export interface BccCommunityChangeRow {
  id: string;
  name: string;
  bcc_code: string;
  status: BccStatus;
  from: number;
  to: number;
  delta: number;
  delta_pct: number | null;
}

export interface BccOverviewRow {
  id: string;
  name: string;
  bcc_code: string;
  families: number;
  people: number;
  trend_pct: number | null;
  trend_delta: number | null;
  primary_leader_name: string | null;
  status: BccStatus;
  attention_flags: string[];
}

export interface BccParishDashboard {
  bccs: { total: number; active: number; inactive: number; suspended: number };
  families: { in_bcc: number; without_bcc: number };
  members: { total: number; active: number };
  leadership: {
    active_leaders: number;
    bccs_without_primary: number;
    bccs_with_primary?: number;
    coverage_percent?: number | null;
    without_primary_list?: Array<{ id: string; name: string; bcc_code: string }>;
  };
  top_bccs: Array<{ id: string; name: string; bcc_code: string; status: BccStatus; family_count: number }>;
  bccs_without_primary_leader: Array<{ id: string; name: string; bcc_code: string }>;
  recent_activity: BccAuditEntry[];
  generated_at?: string;
  filters?: BccDashboardFilters;
  definitions?: Record<string, string>;
  snapshot?: {
    bccs_total: number;
    bccs_active: number;
    bccs_inactive: number;
    bccs_suspended: number;
    families_connected: number;
    people_connected: number;
    active_members: number;
    parish_families: number;
    families_without_bcc: number;
    coverage_percent: number | null;
    coverage_percent_point_change: number | null;
    average_bcc_size: number | null;
    leadership_coverage_percent: number | null;
    active_leaders: number;
    bccs_without_primary: number;
    bccs_with_primary: number;
    empty_bccs: number;
  };
  coverage?: {
    linked: number;
    unlinked: number;
    total: number;
    percent: number | null;
    percent_point_change: number | null;
  };
  growth?: {
    period: string;
    insufficient_history: boolean;
    families: BccGrowthPoint[];
    people: BccGrowthPoint[];
  };
  community_changes?: {
    growing: BccCommunityChangeRow[];
    declining: BccCommunityChangeRow[];
  };
  insights?: Array<{
    id: string;
    severity: BccInsightSeverity;
    text: string;
    reasons?: string[];
  }>;
  attention?: Array<{
    type: BccAttentionType;
    severity: BccInsightSeverity;
    count: number;
    label: string;
  }>;
  community_overview?: {
    rows: BccOverviewRow[];
    limit: number;
    total_matching: number;
    label: string;
  };
  size_distribution?: Array<{ bucket: string; label: string; count: number }>;
  demographics?: {
    total: number;
    gender: Record<string, CountPercent>;
    age_groups: Record<BccAgeBand, BccAgeGroup>;
  };
  data_quality?: {
    completeness_percent: number;
    review_total: number;
    issues: {
      missing_address: number;
      missing_phone: number;
      missing_primary_leader: number;
      unassigned_families: number;
    };
  };
  coordinators?: Array<{ id: string; name: string }>;
}

export interface BccOverview {
  bcc: {
    id: string;
    name: string;
    bcc_code: string;
    status: BccStatus;
    description?: string | null;
    meeting_day?: string | null;
    meeting_time?: string | null;
    meeting_place?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  };
  total_members: number;
  total_families: number;
  active_members: number;
  inactive_members: number;
  gender: {
    male: CountPercent;
    female: CountPercent;
    other: CountPercent;
    unknown: CountPercent;
  };
  age_groups: Record<BccAgeBand, BccAgeGroup>;
  children: { total: number; boys: number; girls: number };
  babies: { total: number; boys: number; girls: number };
  occupation: null;
  education: null;
  families: {
    total: number;
    size_1: number;
    size_2_to_4: number;
    size_5_plus: number;
    average_members: number;
  };
  membership_status: {
    active: number;
    inactive: number;
    deceased: number;
    migrated: number;
  };
  leadership: {
    active_count: number;
    has_primary: boolean;
    primary_leader: string | null;
    roles: Record<string, number>;
  };
  attention: BccDetailAttentionItem[];
  data_quality: BccDetailDataQuality;
  growth: BccDetailGrowth;
  recent_activity: BccAuditEntry[];
}

export type BccDetailAttentionCode = 'no_primary' | 'empty' | 'incomplete_demographics';
export type BccDetailAttentionSeverity = 'warning' | 'info';

export interface BccDetailAttentionItem {
  code: BccDetailAttentionCode;
  severity: BccDetailAttentionSeverity;
  title: string;
  description: string;
  action: {
    label: string;
    tab: BccTab;
  };
}

export interface BccDetailDataQuality {
  complete_count: number;
  incomplete_count: number;
  total: number;
  definition: string;
  missing_gender_count?: number;
  missing_dob_count?: number;
}

export interface BccDetailGrowth {
  period: string;
  insufficient_history: boolean;
  definition?: string;
  members: BccGrowthPoint[];
  families: BccGrowthPoint[];
}

export interface BccMembershipRow {
  id: string;
  bcc_id: string;
  family_id: string;
  status: string;
  is_current: boolean;
  joined_date: string | null;
  exit_date: string | null;
  exit_reason: string | null;
  family: {
    id: string;
    family_name: string;
    family_code: string;
    status: string;
    member_count: number;
  } | null;
  created_by_name?: string | null;
}

export interface BccPersonRow {
  id: string;
  person_id?: string;
  first_name: string;
  last_name: string;
  display_name: string;
  gender: string | null;
  date_of_birth: string | null;
  age: number | null;
  status: string;
  relationship_to_head: string;
  family_id: string;
  family_name: string | null;
  family_code: string | null;
}

export interface BccFamilyLookup {
  id: string;
  family_name: string;
  family_code: string;
  head_of_family?: string;
  status: string;
  member_count: number;
  current_bcc_id: string | null;
  current_bcc_name: string | null;
  eligible: boolean;
}

export interface BccLeaderRow {
  id: string;
  bcc_id: string;
  family_member_id: string;
  role: string;
  role_description?: string | null;
  appointed_date: string | null;
  appointment_date?: string | null;
  term_start_date: string | null;
  effective_from?: string | null;
  term_end_date: string | null;
  effective_to?: string | null;
  term_label?: string | null;
  appointment_reference?: string | null;
  is_interim?: boolean;
  is_active: boolean;
  status?: 'active' | 'completed' | 'vacated' | 'terminated';
  exit_reason?: string | null;
  responsibilities?: string | null;
  notes?: string | null;
  remarks?: string | null;
  member_name: string | null;
  family_name: string | null;
}

export interface BccEligibleMember {
  id: string;
  display_name: string;
  family_id: string;
  family_name: string | null;
  family_code?: string | null;
}

export interface BccAuditEntry {
  id: number | string;
  event: string;
  target_type?: string;
  target_id?: string;
  bcc_id?: string | null;
  bcc_name?: string | null;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  actor_user_id?: number | null;
  actor_name?: string | null;
  created_at: string | null;
}

export interface BccPaged<T> {
  success: boolean;
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
  };
}
