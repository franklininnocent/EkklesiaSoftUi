export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface PaginatedMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginatedMeta;
}

export interface CursorMeta {
  has_more: boolean;
  next_cursor?: string | null;
}

export interface CursorResponse<T> {
  data: T[];
  meta: CursorMeta;
}

export interface ApplicationAccessDashboardWindow {
  label: string;
  starts_at: string;
  ends_at: string;
}

export interface ApplicationAccessDashboardKpis {
  active_sessions: number;
  failed_sign_ins_15m: number;
  blocked_attempts_15m: number;
  support_sessions: number;
  needs_attention_15m: number;
  failed_sign_ins_today_utc: number;
  blocked_attempts_today_utc: number;
}

export interface ApplicationAccessDashboard {
  generated_at: string;
  windows: {
    last_15_minutes: ApplicationAccessDashboardWindow;
    today_utc: ApplicationAccessDashboardWindow;
  };
  kpis: ApplicationAccessDashboardKpis;
}

export interface ApplicationAccessUserSummary {
  id: number;
  name?: string | null;
  email?: string | null;
  tenant_id?: number | null;
}

export interface ApplicationAccessSession {
  id: string;
  session_reference: string;
  user_id?: number | null;
  user?: ApplicationAccessUserSummary | null;
  tenant_id?: number | null;
  role_id?: number | null;
  support_session_id?: string | null;
  identity_type: string;
  access_context: string;
  authentication_status: string;
  status: string;
  started_at: string;
  last_activity_at: string;
  ended_at?: string | null;
  end_reason?: string | null;
  ip_address?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  geo_status?: string | null;
  browser?: string | null;
  browser_version?: string | null;
  operating_system?: string | null;
  device_type?: string | null;
  user_agent?: string | null;
  risk_level: string;
  risk_score: number;
}

export interface ApplicationAccessEvent {
  id: string;
  access_session_id?: string | null;
  user_id?: number | null;
  ip_address?: string | null;
  event_type: string;
  module_code?: string | null;
  action?: string | null;
  route_name?: string | null;
  normalized_route?: string | null;
  http_method?: string | null;
  http_status?: number | null;
  authorization_result?: string | null;
  occurred_at: string;
  risk_level?: string | null;
}

export interface ApplicationSecurityEvent {
  id: string;
  event_type: string;
  severity: string;
  actor_user_id?: number | null;
  source_ip?: string | null;
  authorization_result?: string | null;
  reason_code?: string | null;
  detected_at: string;
}

export interface ApplicationSecuritySignal {
  id: string;
  signal_type: string;
  source_ip?: string | null;
  window_start: string;
  window_end: string;
  event_count: number;
  risk_level: string;
  risk_score: number;
  last_seen: string;
}

export interface ApplicationAccessListParams {
  page?: number;
  per_page?: number;
  status?: string;
  identity_type?: string;
  access_context?: string;
  tenant_id?: number;
  user_id?: number;
  ip_address?: string;
  country?: string;
  started_from?: string;
  started_to?: string;
  from?: string;
  to?: string;
  q?: string;
  email?: string;
  event_type?: string;
  action?: string;
  authorization_result?: string;
  access_session_id?: string;
  severity?: string;
  signal_type?: string;
}

export interface StoreApplicationIpBlockPayload {
  ip_address: string;
  cidr?: string | null;
  reason: string;
  expires_at?: string | null;
}

export interface ApplicationIpBlockRule {
  id: string;
  ip_address: string;
  cidr?: string | null;
  scope: string;
  reason: string;
  expires_at?: string | null;
  revoked_at?: string | null;
}
