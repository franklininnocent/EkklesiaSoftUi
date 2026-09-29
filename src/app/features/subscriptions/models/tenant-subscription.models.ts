import { BillingInterval, PricingType, TaxBreakdown } from './subscription-admin.models';

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

export type UpgradeRequestStatus = 'PENDING' | 'INFO_REQUESTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface UpgradeRequestPlanRef {
  id: number;
  code: string;
  name: string;
}

export interface UpgradeRequest {
  id: number;
  status: UpgradeRequestStatus;
  requested_plan: UpgradeRequestPlanRef | null;
  current_plan: UpgradeRequestPlanRef | null;
  billing_interval: BillingInterval | null;
  feature_code: string | null;
  message: string | null;
  review_notes: string | null;
  requested_by_name: string | null;
  reviewed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  tenant?: { id: number; name: string } | null;
  reviewed_by_name?: string | null;
  resulting_subscription_id?: number | null;
}

export interface SubmitUpgradeRequestPayload {
  plan_code: string;
  billing_interval?: BillingInterval | null;
  feature_code?: string | null;
  message?: string | null;
}

export interface TenantPlanSummary {
  code: string | null;
  key: string | null;
  name: string | null;
  pricing_type: PricingType | string | null;
  is_legacy: boolean;
  version_number: number | null;
}

export interface TenantSubscriptionOverview {
  plan: TenantPlanSummary | null;
  lifecycle: {
    status?: string;
    access_mode?: string;
    allows_gated_access?: boolean;
    grace_ends_at?: string | null;
    days_until_end?: number | null;
    grace_period_days?: number;
    subscription_ends_at?: string | null;
    trial_ends_at?: string | null;
    subscription_suspended_at?: string | null;
    [key: string]: unknown;
  };
  terms: {
    billing_interval: BillingInterval;
    currency_code: string;
    contracted_price: string | null;
    tax_label: string;
    tax: TaxBreakdown | null;
    version_number: number | null;
    starts_at: string | null;
  } | null;
  pending_change: { plan_code: string | null; plan_name: string | null; scheduled_for: string | null } | null;
  entitlements: { code: string; name: string; category: string; enabled: boolean; is_core: boolean }[];
  usage: UsageRow[];
  engine_mode: string;
}
