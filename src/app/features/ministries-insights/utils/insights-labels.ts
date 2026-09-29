/**
 * Ministries Insights–only display labels (platform intelligence).
 * Keep machine codes for filters/API; never alter Tenant M&A copy.
 */

const STATUS_LABELS: Record<string, string> = {
  enabled: 'Enabled',
  disabled: 'Disabled',
  not_started: 'Not started',
  activated: 'Activated',
  active: 'Active',
  inactive: 'Inactive',
  highly_engaged: 'Highly engaged',
  declining: 'Declining',
  ok: 'Ok',
  attention: 'Attention',
  critical: 'Critical',
  up: 'Up',
  flat: 'Flat',
  down: 'Down',
  without_members: 'Without members',
  without_leadership: 'Without leadership',
  stale: 'Stale',
};

const FEATURE_LABELS: Record<string, string> = {
  organizations: 'Organizations',
  members: 'Members',
  leadership: 'Leadership',
  taxonomies: 'Taxonomies',
  guests: 'Guest members',
};

const SUMMARY_KEY_LABELS: Record<string, string> = {
  all_tenants: 'All tenants',
  module_enabled: 'Module enabled',
  not_started: 'Not started',
  activated: 'Activated',
  active: 'Active',
  highly_engaged: 'Highly engaged',
  inactive: 'Inactive',
  declining: 'Declining',
  total: 'Total',
  enabled_tenants: 'Enabled tenants',
  activated_tenants: 'Activated tenants',
  active_tenants: 'Active tenants',
  meaningful_actions: 'Meaningful actions',
  prior_meaningful_actions: 'Prior window actions',
  usage_trend: 'Usage trend',
  active_users: 'Active users',
  current_total: 'Current memberships',
  issue_total: 'Issue total',
  meaningful_events: 'Meaningful events',
};

export function insightsStatusLabel(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  return STATUS_LABELS[value] ?? value.replace(/_/g, ' ');
}

export function insightsFeatureLabel(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  return FEATURE_LABELS[value] ?? value.replace(/_/g, ' ');
}

export function insightsFieldLabel(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  return SUMMARY_KEY_LABELS[value] ?? value.replace(/_/g, ' ');
}

export function insightsSeverityTone(severity: string | null | undefined): 'warning' | 'critical' | 'info' | 'neutral' {
  if (severity === 'critical') {
    return 'critical';
  }
  if (severity === 'attention' || severity === 'warning') {
    return 'warning';
  }
  if (severity === 'info') {
    return 'info';
  }
  return 'neutral';
}
