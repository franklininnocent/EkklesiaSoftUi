import type { MemberAgeChartSlice } from '@features/members/models/member-dashboard.model';

export type ExecutiveSectionState = 'ready' | 'empty' | 'forbidden' | 'unavailable' | 'error';

export interface ExecutiveSection<T = unknown> {
  state: ExecutiveSectionState;
  data?: T;
}

export interface ExecutiveDashboardPayload {
  snapshot: ExecutiveSection<{ cards: Record<string, unknown> }>;
  attention: ExecutiveSection<{ items: ExecutiveAttentionItem[]; all_clear: boolean }>;
  stewardship: ExecutiveSection<ExecutiveStewardshipData>;
  mass_intentions?: ExecutiveSection<ExecutiveMassIntentionsData>;
  worship: ExecutiveSection<ExecutiveWorshipData>;
  pastoral?: ExecutiveSection<ExecutivePastoralData>;
  celebrations: ExecutiveSection<ExecutiveCelebrationsData>;
  quick_actions: ExecutiveSection<{ actions: ExecutiveQuickAction[] }>;
}

export interface ExecutiveMassIntentionsData {
  open: number;
  registered_this_month: number;
  registered_from: string;
  registered_to: string;
  needs_a_mass: number;
  needs_a_tick: number;
  schedule_attention: number;
}

export interface ExecutivePastoralData {
  open_count: number;
  assigned_count: number;
  drilldown: string;
}

export interface ExecutiveAttentionItem {
  key: string;
  count: number;
  drilldown: string;
}

/** Parish financial glance. Values are the Donations Dashboard snapshot, unchanged. */
export interface ExecutiveStewardshipData {
  currency_code: string;
  as_of: string;
  financial_year: string;
  giving_health_label: string;
  collected: number;
  comparison_start: string;
  comparison_end: string;
  comparison_collected: number;
  growth_pct: number | null;
  outstanding_contributions: number;
  project_installments_open: number | null;
  overdue_amount: number;
  overdue_families: number;
  due_next_14_days_amount?: number;
  due_later_amount?: number;
  due_schedule?: ExecutiveDueScheduleSlice[];
  participation_rate: number;
  participation_participating: number;
  participation_active: number;
  participation_net_change: number | null;
  participation_window_start: string;
  participation_window_end: string;
}

export interface ExecutiveWorshipData {
  next_mass: {
    id: string;
    starts_at: string;
    celebrated_on: string;
    celebrated_at: string | null;
  } | null;
  upcoming: Array<{ starts_at: string; celebrated_on: string; celebrated_at: string | null }>;
  this_week_masses: number;
  drilldown: string;
}

export interface ExecutiveCelebrationsData {
  week_label: string;
  week_start: string;
  week_end: string;
  birthdays_count: number;
  anniversaries_count: number;
  drilldown: string;
}

export interface ExecutiveQuickAction {
  key: string;
  drilldown: string;
}

export interface ExecutiveDueScheduleSlice {
  key: 'overdue' | 'next_14_days' | 'later' | string;
  label: string;
  amount: number;
  percent: number;
}

export interface ExecMetric {
  label: string;
  value: string;
  hint?: string;
  compare?: string;
  trend?: 'up' | 'down' | 'flat' | 'none';
  drilldown?: string;
  route?: string;
  query?: Record<string, string>;
  financialLink?: 'donations.payments.month' | 'donations.payments.comparison' | 'donations.dues' | 'donations.dues.overdue' | 'donations.reports.participation';
  tone?:
    | 'forest'
    | 'indigo'
    | 'amber'
    | 'info'
    | 'critical'
    | 'slate'
    | 'stew-teal'
    | 'stew-violet'
    | 'stew-gold'
    | 'stew-sky';
}

export interface ExecBlock {
  key: string;
  title: string;
  openLabel: string;
  openDrilldown: string;
  state: ExecutiveSectionState;
  context?: string;
  unavailableMessage?: string;
  metrics: ExecMetric[];
  /** Compact age distribution for the People executive summary (label includes band key via chart util). */
  memberAgeChart?: MemberAgeChartSlice[];
  dueScheduleChart?: ExecutiveDueScheduleSlice[];
}
