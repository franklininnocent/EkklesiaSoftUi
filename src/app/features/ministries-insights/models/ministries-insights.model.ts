export interface MinistriesInsightsApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
  meta?: MinistriesInsightsPageMeta;
  window?: MinistriesInsightsWindowInfo;
  missing_permissions?: string[];
}

export interface MinistriesInsightsPageMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number;
  to: number;
}

export interface MinistriesInsightsWindowInfo {
  days: number;
  current_start: string;
  current_end: string;
  prior_start?: string;
  prior_end?: string;
}

export interface MinistriesInsightsDefinitions {
  feature_key: string;
  default_activity_window_days: number;
  module_status: Record<string, string>;
  adoption_status: Record<string, string>;
  meaningful_events: string[];
  feature_categories: string[];
  health_indicators: string[];
  health_score: string;
  unavailable_vs_zero: string;
}

export interface MinistriesInsightsMetric {
  value: number | null;
  available: boolean;
  definition?: string;
}

export interface MinistriesInsightsFunnel {
  all_tenants: number;
  module_enabled: number;
  activated: number;
  active: number;
  highly_engaged: number;
}

export interface MinistriesInsightsAttentionItem {
  id: string;
  label: string;
  severity: string;
  description: string;
  count: number;
  filter: Record<string, string>;
  href: string;
  sample_tenants: Array<{ id: number; name: string; slug: string }>;
}

export interface MinistriesInsightsActivityItem {
  id: number;
  occurred_at: string | null;
  event: string;
  event_label: string;
  target_type: string;
  target_id: string;
  organization_id: string | null;
  tenant?: { id: number; name: string; slug: string } | null;
  actor: { id: number; name: string } | null;
}

export interface MinistriesInsightsHealthCounts {
  orgs_without_active_members: number;
  active_orgs_without_leadership: number;
  stale_active_orgs: number;
}

export interface MinistriesInsightsOverviewKpis {
  total_tenants: MinistriesInsightsMetric;
  module_enabled: MinistriesInsightsMetric;
  not_started: MinistriesInsightsMetric;
  activated: MinistriesInsightsMetric;
  active: MinistriesInsightsMetric;
  highly_engaged: MinistriesInsightsMetric;
  inactive: MinistriesInsightsMetric;
  declining: MinistriesInsightsMetric;
  organizations: MinistriesInsightsMetric;
  active_organizations: MinistriesInsightsMetric;
  active_memberships: MinistriesInsightsMetric;
  active_leadership: MinistriesInsightsMetric;
  meaningful_actions: MinistriesInsightsMetric;
  active_users: MinistriesInsightsMetric;
  data_health_issues: MinistriesInsightsMetric;
}

export interface MinistriesInsightsOverview {
  phase: number;
  status: 'scaffold' | 'ready';
  message: string;
  window_days: number | null;
  window?: MinistriesInsightsWindowInfo;
  definitions: MinistriesInsightsDefinitions;
  kpis: MinistriesInsightsOverviewKpis | null;
  funnel: MinistriesInsightsFunnel | null;
  health?: MinistriesInsightsHealthCounts;
  attention: MinistriesInsightsAttentionItem[];
  recent_activity: MinistriesInsightsActivityItem[];
}

export interface MinistriesInsightsTenantRow {
  tenant_id: number;
  tenant_name: string;
  tenant_slug: string;
  module_status: string;
  adoption_status: string;
  health_flag: string;
  organizations_count: number;
  members_count: number;
  leaders_count: number;
  active_users_count: number;
  window_actions: number;
  prior_actions: number;
  usage_trend: 'up' | 'flat' | 'down' | string;
  last_activity_at: string | null;
  activation_date: string | null;
  health: MinistriesInsightsHealthCounts;
  flags: {
    not_started: boolean;
    activated: boolean;
    active: boolean;
    highly_engaged: boolean;
    inactive: boolean;
    declining: boolean;
  };
}

export interface MinistriesInsightsTenantListResponse {
  data: MinistriesInsightsTenantRow[];
  meta: MinistriesInsightsPageMeta;
  window: MinistriesInsightsWindowInfo;
}

export interface MinistriesInsightsTenantDetail {
  summary: MinistriesInsightsTenantRow;
  usage: Record<
    string,
    {
      window_days: number;
      meaningful_actions: number;
      prior_meaningful_actions: number;
      active_days: number;
      usage_trend: string;
    }
  >;
  feature_adoption: Record<string, { used: boolean; event_count: number }>;
  health: MinistriesInsightsHealthCounts;
  recent_actions: MinistriesInsightsActivityItem[];
  window: MinistriesInsightsWindowInfo;
  definitions: MinistriesInsightsDefinitions;
}

export interface MinistriesInsightsTenantFilters {
  window_days?: MinistriesInsightsWindowDays;
  search?: string;
  module_status?: string;
  adoption_status?: string;
  usage_status?: string;
  health?: string;
  sort?: string;
  direction?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}

export interface MinistriesInsightsOrgRow {
  id: string;
  name: string;
  code: string;
  status: string;
  tenant: { id: number; name: string; slug: string } | null;
  category: { id: string; name: string; code: string } | null;
  type: { id: string; name: string; code: string } | null;
  members_count: number;
  leaders_count: number;
  created_at: string | null;
  updated_at: string | null;
  last_activity_at: string | null;
  health_flag: string;
  health: {
    without_members: boolean;
    without_leadership: boolean;
    stale: boolean;
  };
}

export interface MinistriesInsightsOrgFilters {
  search?: string;
  tenant_id?: number | string;
  status?: string;
  health?: string;
  sort?: string;
  direction?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}

export interface MinistriesInsightsOrgListResponse {
  data: MinistriesInsightsOrgRow[];
  meta: MinistriesInsightsPageMeta;
}

export interface MinistriesInsightsHealthSummary {
  organizations: { total: number; active: number; inactive: number };
  indicators: {
    orgs_without_active_members: number;
    active_orgs_without_leadership: number;
    stale_active_orgs: number;
  };
  issue_total: number;
  definitions: Record<string, string>;
  links: Record<string, string>;
}

export type MinistriesInsightsWindowDays = 7 | 30 | 90 | 180 | 365;

export type MinistriesInsightsTabId =
  | 'overview'
  | 'tenants'
  | 'organizations'
  | 'analytics'
  | 'reports';

export type MinistriesInsightsAnalyticsSection =
  | 'adoption'
  | 'usage'
  | 'features'
  | 'trends'
  | 'audit';

export interface MinistriesInsightsAdoptionAnalytics {
  window: MinistriesInsightsWindowInfo;
  funnel: {
    all_tenants: number;
    module_enabled: number;
    not_started: number;
    activated: number;
    active: number;
    highly_engaged: number;
    inactive: number;
    declining: number;
  };
  rates: {
    enabled_of_all: number | null;
    activated_of_enabled: number | null;
    active_of_activated: number | null;
    highly_engaged_of_active: number | null;
  };
  definitions: MinistriesInsightsDefinitions;
}

export interface MinistriesInsightsUsageAnalytics {
  window: MinistriesInsightsWindowInfo;
  summary: {
    enabled_tenants: number;
    activated_tenants: number;
    active_tenants: number;
    meaningful_actions: number;
    prior_meaningful_actions: number;
    usage_trend: string;
    active_users: number;
  };
  frequency_buckets: Record<string, number>;
  trend_counts: Record<string, number>;
  top_tenants: Array<{
    tenant_id: number;
    tenant_name: string;
    tenant_slug: string;
    window_actions: number;
    prior_actions: number;
    active_users_count: number;
    usage_trend: string;
    adoption_status: string | null;
  }>;
}

export interface MinistriesInsightsFeatureCategoryRow {
  category: string;
  tenants_with_evidence: number;
  enabled_tenants: number;
  adoption_percent: number | null;
}

export interface MinistriesInsightsFeaturesAnalytics {
  window: MinistriesInsightsWindowInfo;
  enabled_tenants: number;
  categories: MinistriesInsightsFeatureCategoryRow[];
  drilldown?: {
    category: string;
    tenants: Array<{ tenant_id: number; tenant_name: string; tenant_slug: string }>;
  };
}

export interface MinistriesInsightsTrendsAnalytics {
  window: MinistriesInsightsWindowInfo;
  granularity: 'day' | 'week' | string;
  series: Array<{
    period: string;
    label: string;
    meaningful_actions: number;
    active_tenants: number;
  }>;
  comparison: {
    current_meaningful_actions: number;
    prior_meaningful_actions: number;
    usage_trend: string;
    bucket_active_tenant_sum: number;
  };
}

export interface MinistriesInsightsAuditFilters {
  window_days?: MinistriesInsightsWindowDays;
  date_from?: string;
  date_to?: string;
  tenant_id?: number | string;
  event?: string;
  meaningful_only?: boolean | number;
  page?: number;
  per_page?: number;
}

export interface MinistriesInsightsGovernanceItem {
  id: number;
  occurred_at: string | null;
  operation: string;
  change: 'enabled' | 'disabled' | string;
  source: string | null;
  reason: string | null;
  tenant: { id: number; name: string; slug: string } | null;
  actor: { id: number; name: string } | null;
}

export interface MinistriesInsightsAuditResponse {
  data: MinistriesInsightsActivityItem[];
  meta: MinistriesInsightsPageMeta;
  window: MinistriesInsightsWindowInfo;
  event_options: string[];
  governance: {
    available: boolean;
    reason: string | null;
    items: MinistriesInsightsGovernanceItem[];
    note?: string;
  };
}

export interface MinistriesInsightsReportCatalogItem {
  type: string;
  title: string;
  description: string;
  windowed: boolean;
}

export interface MinistriesInsightsReportSummary {
  type: string;
  title: string;
  window: MinistriesInsightsWindowInfo | null;
  summary: Record<string, unknown>;
  rates?: Record<string, number | null>;
  frequency_buckets?: Record<string, number>;
  trend_counts?: Record<string, number>;
  definitions?: Record<string, string>;
  links?: Record<string, string>;
  preview: unknown[];
  preview_truncated: boolean;
}