export type SupportSessionMode = 'readonly' | 'standard' | 'emergency';

export type SupportReasonCode =
  | 'diagnosis'
  | 'data_fix'
  | 'configuration'
  | 'training'
  | 'incident'
  | 'other';

export interface SupportTenantSummary {
  id: number;
  name: string;
  slug: string;
  tenant_tier?: string | null;
  active: boolean | number;
  domain?: string | null;
  parent_tenant_id?: number | null;
  plan?: string | null;
  hierarchy_path?: string | null;
}

export interface SupportUserSummary {
  id: number;
  name?: string | null;
  email?: string | null;
}

export interface SupportSession {
  id: string;
  support_user_id: number;
  tenant_id: number;
  mode: SupportSessionMode;
  reason_code: SupportReasonCode;
  reason_description?: string | null;
  ticket_ref?: string | null;
  status: 'active' | 'ended' | 'expired';
  started_at: string;
  expires_at: string;
  ended_at?: string | null;
  ended_reason?: string | null;
  ip_address?: string | null;
  tenant?: SupportTenantSummary | null;
  support_user?: SupportUserSummary | null;
}

export interface StartSupportSessionPayload {
  tenant_id: number;
  mode: SupportSessionMode;
  reason_code: SupportReasonCode;
  reason_description?: string;
  ticket_ref?: string;
  password: string;
  confirm_emergency?: boolean;
  approval_request_id?: string;
}

export interface SupportHistoryFilters {
  scope?: 'all' | 'mine';
  status?: '' | 'active' | 'ended' | 'expired';
  mode?: '' | SupportSessionMode;
  tenant_id?: number | null;
  q?: string;
  from?: string;
  to?: string;
  per_page?: number;
  page?: number;
}

export interface SupportOpsSettings {
  timeout_minutes: number;
  max_concurrent_sessions: number;
  max_sessions_per_user: number;
  start_rate_limit_per_hour: number;
  notification_mode: 'never' | 'immediate' | 'digest';
  customer_disclosure_enabled: boolean;
  emergency_requires_approval: boolean;
  require_customer_grant: boolean;
  jit_enabled: boolean;
  jit_timeout_minutes: number;
  approval_request_ttl_minutes: number;
  require_ticket_ref: boolean;
  ticket_validation_mode: 'off' | 'required_format' | 'adapter';
  ip_binding_mode?: 'off' | 'soft' | 'strict';
  allowed_timeouts: number[];
  notification_modes: Array<'never' | 'immediate' | 'digest'>;
  ticket_validation_modes?: Array<'off' | 'required_format' | 'adapter'>;
  ip_binding_modes?: Array<'off' | 'soft' | 'strict'>;
}

export interface SupportSessionMetrics {
  active_count: number;
  pending_approvals: number;
  expiring_soon_count: number;
  expiring_within_minutes: number;
}

export type SupportApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'consumed'
  | 'expired'
  | 'cancelled';

export interface SupportAccessRequest {
  id: string;
  requester_user_id: number;
  tenant_id: number;
  mode: SupportSessionMode;
  reason_code: SupportReasonCode;
  reason_description?: string | null;
  ticket_ref?: string | null;
  status: SupportApprovalStatus;
  requested_at: string;
  expires_at: string;
  decided_at?: string | null;
  decision_note?: string | null;
  consumed_session_id?: string | null;
  tenant?: SupportTenantSummary | null;
  requester?: SupportUserSummary | null;
  decided_by?: SupportUserSummary | null;
}

export type SupportGrantStatus = 'active' | 'revoked' | 'expired';
export type SupportGrantMode = SupportSessionMode | 'any';

export interface SupportAccessGrant {
  id: string;
  tenant_id: number;
  granted_by_user_id: number;
  allowed_mode: SupportGrantMode;
  starts_at: string;
  ends_at: string;
  status: SupportGrantStatus;
  note?: string | null;
  max_sessions?: number | null;
  sessions_used: number;
  tenant?: SupportTenantSummary | null;
  granted_by?: SupportUserSummary | null;
}

export interface SupportSessionEvent {
  id: number;
  support_session_id: string;
  actor_user_id: number;
  effective_tenant_id: number;
  event_type: string;
  module?: string | null;
  page?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  action?: string | null;
  created_at: string;
  actor?: SupportUserSummary | null;
  tenant?: SupportTenantSummary | null;
}

export interface SupportEventFilters {
  support_session_id?: string;
  effective_tenant_id?: number | null;
  event_type?: string;
  module?: string;
  q?: string;
  from?: string;
  to?: string;
  per_page?: number;
}

export interface RecordSupportEventPayload {
  event_type?: string;
  module?: string;
  page?: string;
  entity_type?: string;
  entity_id?: string;
  action?: string;
  metadata?: Record<string, unknown>;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface PaginatedPayload<T> {
  data: T[];
  current_page?: number;
  last_page?: number;
  per_page?: number;
  total?: number;
}
