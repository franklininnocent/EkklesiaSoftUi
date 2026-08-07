export interface PaginationMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedApiResponse<T> {
  success: boolean;
  data: T[];
  /** Present when the endpoint paginates; taxonomy lists may omit meta when `per_page` is omitted. */
  meta?: PaginationMeta;
}

export interface ModuleStatus {
  enabled: boolean;
  feature_key: string;
}

export interface OrganizationCategory {
  id: string;
  tenant_id: number;
  code: string;
  name: string;
  description: string | null;
  is_system?: boolean;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrganizationType {
  id: string;
  tenant_id: number;
  code: string;
  name: string;
  description: string | null;
  is_system?: boolean;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Position {
  id: string;
  tenant_id: number;
  code: string;
  name: string;
  description: string | null;
  single_occupancy: boolean;
  is_system?: boolean;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrganizationSettings {
  allow_multi_role_holding: boolean;
  guests_can_hold_office: boolean;
}

export interface OrganizationSocialLinks {
  facebook?: string | null;
  instagram?: string | null;
  whatsapp?: string | null;
  youtube?: string | null;
  telegram?: string | null;
}

export interface OrganizationCounts {
  total_members: number;
  active_members: number;
  active_office_bearers: number;
}

export interface Organization {
  id: string;
  tenant_id: number;
  code: string;
  name: string;
  short_name: string | null;
  category_id: string;
  category?: Pick<OrganizationCategory, 'id' | 'name' | 'code'>;
  type_id: string;
  type?: Pick<OrganizationType, 'id' | 'name' | 'code'>;
  description: string | null;
  vision: string | null;
  mission: string | null;
  objectives: string | null;
  patron_saint: string | null;
  established_date: string | null;
  theme_color: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  social_links: OrganizationSocialLinks | null;
  status: 'active' | 'inactive';
  settings?: OrganizationSettings;
  counts?: OrganizationCounts;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface OrganizationSummary {
  total_members: number;
  active_members: number;
  guest_members: number;
  active_office_bearers: number;
  leadership_vacancies: number;
}

export interface CreateOrganizationPayload {
  code: string;
  name: string;
  short_name?: string | null;
  category_id: string;
  type_id: string;
  description?: string | null;
  vision?: string | null;
  mission?: string | null;
  objectives?: string | null;
  patron_saint?: string | null;
  established_date?: string | null;
  theme_color?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  social_links?: OrganizationSocialLinks;
  status?: 'active' | 'inactive';
  settings?: OrganizationSettings;
}

export type UpdateOrganizationPayload = Partial<CreateOrganizationPayload>;

export interface UpdateOrganizationStatusPayload {
  status: 'active' | 'inactive';
}

export interface DeletedOrganizationResult {
  id: string;
  deleted_at: string | null;
}

export type MemberSource = 'parish' | 'guest';

export type MemberType = 'regular' | 'honorary' | 'life' | 'junior';

export type MembershipStatus =
  | 'active'
  | 'inactive'
  | 'suspended'
  | 'resigned'
  | 'exited'
  | 'deceased';

export interface OrganizationMembership {
  id: string;
  organization_id: string;
  member_source: MemberSource;
  family_member_id: string | null;
  guest_member_id: string | null;
  display_name: string;
  family_name: string | null;
  member_type: MemberType;
  status: MembershipStatus;
  joined_date: string;
  exit_date: string | null;
  exit_reason: string | null;
  remarks: string | null;
  emergency_contact: string | null;
  is_current: boolean;
  interval_label: string;
  created_at: string;
}

export interface EnrollMemberPayload {
  member_source: MemberSource;
  family_member_id?: string;
  guest_member_id?: string;
  member_type?: MemberType;
  joined_date: string;
  remarks?: string | null;
  emergency_contact?: string | null;
}

export interface UpdateMembershipStatusPayload {
  status: MembershipStatus;
  exit_date?: string;
  exit_reason?: string | null;
}

export interface ReEnrollMemberPayload {
  joined_date: string;
  member_type?: MemberType;
  remarks?: string | null;
}

export type LeadershipStatus = 'active' | 'completed' | 'vacated' | 'terminated';

export type LeadershipExitReason =
  | 'resigned'
  | 'transferred'
  | 'removed'
  | 'term_completed'
  | 'deceased'
  | 'census_cascade';

export interface LeadershipHolder {
  display_name: string | null;
  member_source: MemberSource;
  family_member_id: string | null;
  guest_member_id: string | null;
}

export interface LeadershipTerm {
  id: string;
  organization_id: string;
  membership_id: string;
  position_id: string;
  position: Pick<Position, 'id' | 'code' | 'name' | 'single_occupancy'> | null;
  holder: LeadershipHolder | null;
  appointment_date: string;
  effective_from: string;
  effective_to: string | null;
  term_label: string | null;
  appointment_reference: string | null;
  is_interim: boolean;
  status: LeadershipStatus;
  exit_reason: LeadershipExitReason | null;
  remarks: string | null;
  created_at: string;
}

export interface CurrentLeadershipPositionRow {
  position: Pick<Position, 'id' | 'code' | 'name' | 'single_occupancy'>;
  current_terms: LeadershipTerm[];
  vacant: boolean;
}

export interface CurrentLeadershipResponse {
  positions: CurrentLeadershipPositionRow[];
}

export interface AssignLeadershipPayload {
  membership_id: string;
  position_id: string;
  appointment_date: string;
  effective_from: string;
  effective_to?: string | null;
  term_label?: string | null;
  appointment_reference?: string | null;
  is_interim?: boolean;
  remarks?: string | null;
}

export type LeadershipHandoverIncomingPayload = Omit<AssignLeadershipPayload, 'position_id'>;

export interface LeadershipHandoverPayload {
  position_id: string;
  outgoing_term_id: string;
  outgoing: {
    effective_to: string;
    exit_reason: Exclude<LeadershipExitReason, 'census_cascade'>;
  };
  incoming: LeadershipHandoverIncomingPayload;
}

export interface TerminateLeadershipPayload {
  effective_to: string;
  exit_reason: Exclude<LeadershipExitReason, 'census_cascade'>;
  remarks?: string | null;
}

export interface LeadershipConflict {
  type: 'leadership_overlap';
  existing_term_id: string;
  existing_holder: {
    id: string;
    display_name: string | null;
  };
}

export type GuestType =
  | 'supporter'
  | 'volunteer'
  | 'benefactor'
  | 'advisor'
  | 'resource_person';

export type GuestSupportType = 'financial' | 'labor' | 'advisory';

export interface GuestLinkedParishioner {
  id: string;
  display_name: string | null;
  family_name: string | null;
}

export interface GuestMember {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  gender: 'male' | 'female' | 'other' | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  guest_type: GuestType;
  external_organization: string | null;
  support_type: GuestSupportType | null;
  remarks: string | null;
  linked_family_member_id: string | null;
  linked_parishioner: GuestLinkedParishioner | null;
  created_at: string;
  updated_at: string;
}

export interface CreateGuestMemberPayload {
  first_name: string;
  last_name: string;
  phone?: string | null;
  email?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  address?: string | null;
  guest_type?: GuestType;
  external_organization?: string | null;
  support_type?: GuestSupportType | null;
  remarks?: string | null;
}

export type UpdateGuestMemberPayload = Partial<CreateGuestMemberPayload>;

export interface LinkGuestParishionerPayload {
  family_member_id: string;
}

export interface ParishionerLookupResult {
  family_member_id: string;
  full_name: string;
  family_id: string;
  family_name: string | null;
  family_code: string | null;
  gender: string | null;
  phone: string | null;
  photo_url: string | null;
  census_status: string;
  active_ministry_count: number;
  eligible: boolean;
  ineligible_reason: string | null;
}

export interface FamilyAffiliationMembership {
  membership_id: string;
  status: MembershipStatus;
  joined_date: string;
  exit_date: string | null;
  interval_label: string;
}

export interface FamilyAffiliationLeadership {
  term_id: string;
  position_name: string;
  is_interim: boolean;
  effective_from: string;
  effective_to: string | null;
  status: LeadershipStatus;
}

export interface FamilyAffiliation {
  organization: Pick<Organization, 'id' | 'name' | 'code' | 'status'>;
  memberships: FamilyAffiliationMembership[];
  leadership_terms: FamilyAffiliationLeadership[];
}

export interface FamilyAffiliationsResponse {
  family_member_id: string;
  affiliations: FamilyAffiliation[];
}

export interface EnrollFromFamilyPayload {
  organization_id: string;
  member_type?: MemberType;
  joined_date: string;
  remarks?: string | null;
}

export interface MinistriesAuditLogEntry {
  id: string;
  event: string;
  action_type: string;
  target_type: string;
  entity_type: string;
  target_id: string;
  entity_id: string;
  organization_id: string | null;
  actor_user_id: number | null;
  actor_name: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface MinistriesDashboardOrganizationCounts {
  total: number;
  active: number;
  inactive: number;
}

export interface MinistriesDashboardMembershipCounts {
  active: number;
  inactive: number;
  guest_active: number;
}

export interface MinistriesDashboardExpiringTerm {
  term_id: string;
  organization_id: string;
  organization_name: string | null;
  position_name: string | null;
  holder_name: string | null;
  effective_to: string | null;
  is_interim: boolean;
}

export interface MinistriesDashboardLeadership {
  filled_positions: number;
  vacancies: number;
  expiring_soon: MinistriesDashboardExpiringTerm[];
}

export interface MinistriesDashboardTopOrganization {
  id: string;
  name: string;
  code: string | null;
  active_members: number;
  active_office_bearers: number;
}

export interface MinistriesDashboardSummary {
  organizations: MinistriesDashboardOrganizationCounts;
  memberships: MinistriesDashboardMembershipCounts;
  leadership: MinistriesDashboardLeadership;
  top_organizations: MinistriesDashboardTopOrganization[];
  guest_members_total: number;
}

export interface OrganizationListParams {
  page?: number;
  per_page?: number;
  search?: string;
  category_id?: string;
  type_id?: string;
  status?: 'active' | 'inactive';
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
  include?: string;
}

export interface MembershipListParams {
  page?: number;
  per_page?: number;
  search?: string;
  status?: MembershipStatus;
  member_type?: MemberType;
  member_source?: MemberSource;
  is_current?: boolean;
}

export interface AuditLogListParams {
  page?: number;
  per_page?: number;
  entity_type?: string;
  entity_id?: string;
  user_id?: number;
  action_type?: string;
  date_from?: string;
  date_to?: string;
}
