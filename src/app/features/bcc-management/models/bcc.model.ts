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

export interface BccGrowthPoint {
  period: string;
  label: string;
  value: number;
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
  family_id?: string | null;
  family_name: string | null;
  leader_phone?: string | null;
  leader_email?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
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
