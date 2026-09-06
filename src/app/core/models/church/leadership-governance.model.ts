export type LeadershipCategory =
  | 'CANONICAL_DIOCESAN'
  | 'PARISH_CLERGY'
  | 'PARISH_COUNCIL'
  | 'MINISTRY_PIOUS'
  | 'OTHER';

export type LeadershipStatus = 'active' | 'completed' | 'vacated' | 'transferred';

export type LeadershipExitReasonCode =
  | 'transferred'
  | 'retired'
  | 'resigned'
  | 'removed'
  | 'completed'
  | 'deceased'
  | 'other';

export interface LeadershipRoleOption {
  id: string;
  title: string;
  category: LeadershipCategory;
  category_label: string;
  hierarchical_level: number;
  allows_concurrent: boolean;
  is_canonical_mandate: boolean;
  is_global: boolean;
}

export interface LeadershipPersonSummary {
  id: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  email?: string | null;
  phone?: string | null;
  status?: string;
  photo_url?: string | null;
  photo_full_url?: string | null;
}

export interface LeadershipAssignment {
  id: string;
  tenant_id: number;
  church_profile_id: number;
  person_id: string;
  person: LeadershipPersonSummary | null;
  role_id: string;
  role: {
    id: string;
    title: string;
    category: LeadershipCategory;
    category_label: string;
    hierarchical_level: number;
    allows_concurrent: boolean;
  } | null;
  jurisdiction_name?: string | null;
  appointment_date?: string | null;
  start_date: string;
  end_date?: string | null;
  status: LeadershipStatus;
  appointment_letter_ref?: string | null;
  exit_reason_code?: LeadershipExitReasonCode | null;
  exit_reason_note?: string | null;
  duration_days?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface CurrentLeadershipResponse {
  church_profile_id: number;
  active_count: number;
  groups: Array<{
    category: LeadershipCategory;
    category_label: string;
    hierarchical_level: number;
    assignments: LeadershipAssignment[];
  }>;
  assignments: LeadershipAssignment[];
}

export interface AssignLeadershipPayloadBase {
  is_external: boolean;
  role_id: string;
  appointment_date?: string | null;
  start_date: string;
  end_date?: string | null;
  jurisdiction_name?: string | null;
  appointment_letter_ref?: string | null;
}

export interface AssignExistingPersonPayload extends AssignLeadershipPayloadBase {
  is_external: false;
  person_id: string;
}

export interface AssignExternalLeaderPayload extends AssignLeadershipPayloadBase {
  is_external: true;
  first_name: string;
  last_name: string;
}

export type AssignLeadershipPayload = AssignExistingPersonPayload | AssignExternalLeaderPayload;

export interface HandoverLeadershipPayload {
  outgoing_assignment_id: string;
  outgoing_end_date: string;
  outgoing_exit_reason_code: LeadershipExitReasonCode;
  outgoing_exit_reason_note?: string | null;
  person_id: string;
  role_id?: string | null;
  appointment_date?: string | null;
  start_date: string;
  end_date?: string | null;
  jurisdiction_name?: string | null;
  appointment_letter_ref?: string | null;
}

export interface TerminateLeadershipPayload {
  end_date: string;
  exit_reason_code: LeadershipExitReasonCode;
  exit_reason_note?: string | null;
}

export interface UpdateLeadershipAssignmentPayload {
  role_id: string;
  first_name: string;
  last_name: string;
  appointment_date?: string | null;
  start_date: string;
  jurisdiction_name?: string | null;
  appointment_letter_ref?: string | null;
}

export interface LeadershipHistoryFilters {
  person_id?: string;
  role_id?: string;
  category?: LeadershipCategory | '';
  status?: LeadershipStatus | '';
  from?: string;
  to?: string;
  as_of?: string;
  page?: number;
  per_page?: number;
}

export interface PaginatedLeadershipHistory {
  success: boolean;
  data: LeadershipAssignment[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
  };
}

export interface LeadershipIncumbentConflict {
  incumbent?: LeadershipAssignment;
}
