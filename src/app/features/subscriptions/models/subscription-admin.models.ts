/**
 * Platform subscription catalog shapes returned by /api/admin/subscriptions/*.
 * Money is always a decimal string; null limits mean unlimited.
 */

export type PricingType = 'FIXED' | 'CUSTOM' | 'FREE';
export type PlanStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type PlanVersionStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'RETIRED';
export type BillingInterval = 'MONTHLY' | 'ANNUAL' | 'CUSTOM';
export type FeatureType = 'BOOLEAN' | 'LIMIT' | 'QUOTA' | 'USAGE' | 'MODULE' | 'TIER' | 'CUSTOM';

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PageMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface PagedEnvelope<T> extends ApiEnvelope<T[]> {
  meta: PageMeta;
}

export interface VersionEntitlement {
  feature_code: string;
  feature_name: string;
  feature_type: FeatureType;
  category: string;
  unit: string | null;
  is_core: boolean;
  is_enabled: boolean;
  numeric_value: number | null;
  unlimited: boolean;
  tier_value: string | null;
}

export interface EffectiveTaxPolicy {
  label: string;
  rate_percent: string;
  prices_include_tax: boolean;
  source: 'platform' | 'plan_version';
}

export interface PlanVersion {
  id: number;
  plan_id: number;
  version_number: number;
  status: PlanVersionStatus;
  currency_code: string;
  monthly_price: string | null;
  annual_price: string | null;
  setup_fee: string | null;
  tax_inclusive: boolean;
  tax_rate_percent: string | null;
  tax_label: string | null;
  effective_tax?: EffectiveTaxPolicy;
  trial_days: number | null;
  billing_intervals: BillingInterval[];
  effective_from: string | null;
  published_at: string | null;
  retired_at: string | null;
  change_notes: string | null;
  is_editable: boolean;
  entitlements?: VersionEntitlement[];
  tenant_count?: number;
}

export interface PlanEditRestriction {
  code: string;
  message: string;
  tenant_count: number;
}

export interface PlanFieldPolicy {
  field: string;
  reason: string;
}

export interface PlanEditPolicy {
  tenant_count: number;
  safe_fields: string[];
  restricted_fields: PlanFieldPolicy[];
  immutable_fields: PlanFieldPolicy[];
}

export interface CatalogPlan {
  id: number;
  code: string;
  key: string;
  slug: string;
  name: string;
  short_description: string | null;
  description: string | null;
  pricing_type: PricingType;
  status: PlanStatus;
  is_public: boolean;
  is_featured: boolean;
  is_assignable: boolean;
  is_legacy: boolean;
  is_default: boolean;
  badge_label: string | null;
  display_order: number;
  archived_at: string | null;
  tenant_count: number;
  /** Plan header fields may be edited in place (false for legacy plans). */
  is_editable: boolean;
  edit_restriction: PlanEditRestriction | null;
  edit_policy: PlanEditPolicy;
  /** Super Admin may delete when no churches or open requests block removal. */
  can_delete: boolean;
  delete_restriction: PlanEditRestriction | null;
  active_version: PlanVersion | null;
  versions?: PlanVersion[];
}

export interface PlanFormValue {
  code?: string;
  name: string;
  slug?: string | null;
  short_description?: string | null;
  description?: string | null;
  pricing_type?: PricingType;
  is_public?: boolean;
  is_featured?: boolean;
  is_assignable?: boolean;
  badge_label?: string | null;
  display_order?: number | null;
  confirm_assignment_impact?: boolean;
}

export interface VersionTermsValue {
  currency_code?: string;
  monthly_price?: string | null;
  annual_price?: string | null;
  setup_fee?: string | null;
  tax_inclusive?: boolean;
  tax_rate_percent?: string | null;
  tax_label?: string | null;
  trial_days?: number | null;
  billing_intervals?: BillingInterval[];
  change_notes?: string | null;
}

export interface EntitlementInput {
  feature_code: string;
  is_enabled: boolean;
  numeric_value?: number | null;
  tier_value?: string | null;
}

export interface CatalogFeature {
  id: number;
  code: string;
  name: string;
  description: string | null;
  category: string;
  module_key: string | null;
  feature_type: FeatureType;
  unit: string | null;
  legacy_key: string | null;
  is_core: boolean;
  is_public: boolean;
  is_active: boolean;
  display_order: number;
  tier_options: string[] | null;
  dependencies: string[];
}

export interface FeatureFormValue {
  code?: string;
  name: string;
  description?: string | null;
  category: string;
  module_key?: string | null;
  feature_type?: FeatureType;
  unit?: string | null;
  tier_options?: string[] | null;
  is_public?: boolean;
  is_active?: boolean;
  display_order?: number | null;
}

export interface MatrixFeature {
  id: number;
  code: string;
  name: string;
  category: string;
  feature_type: FeatureType;
  unit: string | null;
  is_core: boolean;
  is_active: boolean;
}

export interface MatrixCell {
  is_enabled: boolean;
  numeric_value: number | null;
  tier_value: string | null;
}

export interface MatrixColumn {
  plan: { id: number; code: string; name: string; status: PlanStatus; is_featured: boolean };
  version: { id: number; version_number: number; status: PlanVersionStatus } | null;
  /** Keyed by feature id. */
  cells: Record<string, MatrixCell>;
}

export interface FeatureMatrix {
  features: MatrixFeature[];
  plans: MatrixColumn[];
}

export interface FeatureChange {
  code: string;
  name: string;
}

export interface LimitChange {
  code: string;
  name: string;
  unit: string | null;
  from: number | null;
  to: number | null;
  decrease: boolean;
  usage?: number | null;
}

export interface VersionImpactGroup {
  from_version_id: number;
  from_version_number: number;
  from_status: PlanVersionStatus;
  tenant_count: number;
  features_gained: FeatureChange[];
  features_lost: FeatureChange[];
  limit_changes: LimitChange[];
  over_limit: { code: string; name: string; limit: number; tenant_count: number }[];
}

export interface VersionImpact {
  version: { id: number; plan_id: number; version_number: number; status: PlanVersionStatus };
  tenants_on_candidate: number;
  tenants_on_other_versions: number;
  tenants_over_new_limits: number;
  groups: VersionImpactGroup[];
  requires_confirmation: boolean;
  data_preserved: boolean;
}

export interface PublicPlanCard {
  code: string;
  name: string;
  short_description: string | null;
  badge_label: string | null;
  is_featured: boolean;
  pricing_type: PricingType;
  currency_code: string;
  monthly_price: string | null;
  annual_price: string | null;
  trial_days: number | null;
  billing_intervals: BillingInterval[];
  tax: {
    label: string;
    rate_percent: string | null;
    prices_include_tax: boolean;
    monthly?: TaxBreakdown | null;
    annual?: TaxBreakdown | null;
  };
  features?: { code: string; name: string; category: string }[];
  limits?: { code: string; name: string; unit: string | null; value: number | null; unlimited: boolean }[];
  display_order?: number;
  version_number?: number | null;
  id?: number;
  is_current?: boolean;
  listed_in_catalog?: boolean;
  using_subscribed_version?: boolean;
  primary_action?: 'current' | 'request' | 'quote';
  subscription_status?: string | null;
  subscription_ends_at?: string | null;
  is_lifetime?: boolean;
}

export interface SubscriptionOverview {
  total_tenants: number;
  assigned_tenants: number;
  plans: { plan_id: number; code: string; name: string; is_legacy: boolean; status: string; tenant_count: number }[];
  status_counts: Record<string, number>;
  open_requests: number;
  tenants_needing_attention: number;
  usage_measured_on: string | null;
}

export interface SubscriptionRevenue {
  label: string;
  totals: { currency_code: string; mrr: string; arr: string }[];
  by_plan: { plan_id: number; plan_name: string | null; currency_code: string; mrr: string }[];
  counted_tenants: number;
  excluded: { trial: number; expired: number; suspended: number; unpriced: number };
  counted_statuses: string[];
}

export interface TenantUsageRow {
  tenant_id: number;
  tenant_name: string;
  worst_level: string;
  usage: { code: string; name: string; unit: string | null; usage: number; limit: number | null; level: string }[];
}

export interface TenantUsagePage {
  snapshot_date: string | null;
  data: TenantUsageRow[];
  meta: { current_page: number; per_page: number; total: number; last_page: number };
}

export type UpgradeRequestFilter = 'OPEN' | 'PENDING' | 'INFO_REQUESTED' | 'APPROVED' | 'REJECTED' | 'ALL';

export interface ApproveUpgradeInput {
  billing_interval?: BillingInterval | null;
  contracted_price?: string | null;
  scheduled_for?: string | null;
  confirm_impact?: boolean;
  note?: string | null;
}

export interface TaxBreakdown {
  net: string;
  tax: string;
  gross: string;
  rate_percent: string;
  inclusive: boolean;
}

export interface VersionPreview {
  card: PublicPlanCard;
  version: { id: number; version_number: number; status: PlanVersionStatus };
  modules: { code: string; name: string; category: string; module_key: string | null; is_core: boolean; enabled: boolean; tier: string | null }[];
  limits: { code: string; name: string; unit: string | null; value: number | null; unlimited: boolean }[];
}

export interface PlanTenantRow {
  tenant_id: number;
  tenant_name: string | null;
  tenant_tier: string | null;
  lifecycle_status: string | null;
  version_id: number;
  version_number: number | null;
  billing_interval: BillingInterval;
  contracted_price: string | null;
  currency_code: string;
  starts_at: string | null;
}

export interface MigrateTenantsResult {
  dry_run: boolean;
  eligible: number;
  processed: number;
  migrated: number[];
  skipped: { tenant_id: number; tenant_name: string; code: string; message: string }[];
  preview: { tenant_id: number; tenant_name: string; from_version_id: number; requires_confirmation: boolean; features_lost: string[]; over_limit: string[] }[];
  remaining: number;
}

export type OverLimitBehavior = 'BLOCK_NEW' | 'WARN_ONLY';

export interface SubscriptionPolicies {
  usage_thresholds: number[];
  over_limit_behavior: OverLimitBehavior;
  limit_exempt_flows: string[];
  currency_code: string;
  downgrade_behavior: string;
  trial: { allow_trial_on_assignment: boolean; max_trial_days: number };
  tax: { label: string; rate_percent: string; prices_include_tax: boolean };
  upgrade_requests: { enabled: boolean };
}

export interface PoliciesPayload {
  default_plan: { id: number; code: string; name: string } | null;
  policies: SubscriptionPolicies;
  options: {
    over_limit_behavior: OverLimitBehavior[];
    limit_exempt_flows: string[];
  };
}

export interface PoliciesUpdate extends Partial<Omit<SubscriptionPolicies, 'downgrade_behavior'>> {
  default_plan_id?: number | null;
  reason?: string | null;
}

export interface PlatformTaxJurisdiction {
  country_code: string;
  tax_system: string;
}

export interface PlatformTaxConfig {
  label: string;
  rate_percent: string;
  prices_include_tax: boolean;
  jurisdiction?: PlatformTaxJurisdiction;
}

export interface TaxImpactPlanRef {
  code: string;
  name: string;
}

export interface TaxConfigurationPayload {
  tax: PlatformTaxConfig;
  currency_code: string;
  updated_at: string | null;
  updated_by: { actor_id: number | null; actor_role: string | null; updated_at: string | null } | null;
  impact: {
    catalog: {
      inheriting_count: number;
      overridden_count: number;
      inheriting_plans: TaxImpactPlanRef[];
      overridden_plans: TaxImpactPlanRef[];
    };
    subscriptions: {
      inheriting_count: number;
      overridden_count: number;
    };
  };
}

export interface TaxPreviewBreakdown {
  net: string;
  tax: string;
  gross: string;
  rate_percent: string;
  inclusive: boolean;
  currency_code: string;
}

export interface TaxConfigurationUpdate {
  tax: PlatformTaxConfig;
  reason?: string | null;
}

export interface CatalogAuditEntry {
  id: number;
  entity_type: string;
  entity_id: number | null;
  operation: string;
  actor_id: number | null;
  actor_role: string | null;
  reason: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  correlation_id: string | null;
  created_at: string | null;
}

export type UsageLevel = 'ok' | 'notice' | 'warning' | 'critical' | 'at_limit' | 'over_limit';

export interface UsageRow {
  code: string;
  name: string;
  unit: string | null;
  usage: number;
  limit: number | null;
  unlimited: boolean;
  remaining: number | null;
  percent_used: number | null;
  level: UsageLevel;
}

export interface PlanSummary {
  code: string | null;
  key: string | null;
  name: string | null;
  pricing_type: PricingType | null;
  is_legacy: boolean;
  version_number: number | null;
}

export type OverrideMode = 'ENABLE' | 'DISABLE' | 'SET_LIMIT' | 'UNLIMITED' | 'SET_TIER';

export interface EntitlementOverride {
  id: number;
  feature_code: string | null;
  feature_name: string | null;
  mode: OverrideMode;
  numeric_value: number | null;
  tier_value: string | null;
  reason: string | null;
  effective_from: string | null;
  effective_until: string | null;
  revoked_at: string | null;
  revoke_reason: string | null;
  created_by: number | null;
  created_at: string | null;
}

export interface SubscriptionHistoryRow {
  id: number;
  plan_code: string | null;
  plan_name: string | null;
  version_number: number | null;
  record_status: string;
  billing_interval: BillingInterval;
  contracted_price: string | null;
  currency_code: string;
  source: string | null;
  reason: string | null;
  starts_at: string | null;
  scheduled_for: string | null;
  superseded_at: string | null;
  created_at: string | null;
}

export interface AdminTenantSubscription {
  tenant: { id: number; name: string; plan_key: string | null };
  plan: PlanSummary | null;
  lifecycle: { status: string; trial_ends_at: string | null; subscription_suspended_at: string | null } & Record<string, unknown>;
  terms: {
    billing_interval: BillingInterval;
    currency_code: string;
    contracted_price: string | null;
    tax_label: string;
    version_number: number;
    starts_at: string | null;
  } | null;
  pending_change: { plan_code: string | null; plan_name: string | null; scheduled_for: string | null } | null;
  entitlements: { code: string; name: string; category: string; enabled: boolean; is_core: boolean }[];
  usage: UsageRow[];
  engine_mode: string;
  history: SubscriptionHistoryRow[];
  overrides: EntitlementOverride[];
}

export interface PlanChangePreview {
  target_plan: { id: number; code: string; name: string; version_id: number; version_number: number };
  features_gained: FeatureChange[];
  features_lost: FeatureChange[];
  limit_changes: LimitChange[];
  over_limit: (LimitChange & { over_by: number })[];
  is_downgrade: boolean;
  requires_confirmation: boolean;
  revoked_backfill_overrides: number;
  data_preserved: boolean;
}

export interface AssignPlanInput {
  plan_id: number;
  billing_interval?: BillingInterval | null;
  contracted_price?: string | null;
  duration_months?: number | null;
  start_trial?: boolean;
  scheduled_for?: string | null;
  confirm_impact?: boolean;
  reason: string;
}

export interface GrantOverrideInput {
  feature_code: string;
  mode: OverrideMode;
  numeric_value?: number | null;
  tier_value?: string | null;
  effective_from?: string | null;
  effective_until?: string | null;
  reason: string;
}

/** Structured subscription API error body ({ code, message, ... }). */
export interface SubscriptionApiError {
  code?: string;
  message?: string;
  errors?: Record<string, string[]>;
  impact?: unknown;
}
