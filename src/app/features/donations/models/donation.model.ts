export interface DonationDashboardSummary {
  totals: {
    collected: number;
    refunded: number;
    net: number;
    pending_dues: number;
    active_projects: number;
    voluntary_collected?: number;
    voluntary_pledged_outstanding?: number;
    voluntary_entries?: number;
    anonymous_donations?: number;
    active_recurring_schedules?: number;
  };
  collections_by_method: Record<string, number>;
  voluntary_by_category?: Array<{ category_id?: string | null; category_name: string; collected: number }>;
  financial_health?: FinancialHealthScore;
  health_scores?: DashboardHealthScores;
  kpis?: DashboardKpis;
  collection_performance_chart?: CollectionPerformanceChart;
  proactive_insights?: ProactiveInsight[];
  families?: {
    total: number;
    active: number;
    participating_last_90_days: number;
    participation_rate: number;
  };
  period_collections?: {
    financial_year: string;
    current_month_collected: number;
    previous_month_collected: number;
    annual_collected: number;
  };
  collection_trend?: Array<{ period: string; label: string; collected: number }>;
  families_requiring_attention?: Array<{
    family_id: string;
    family_name?: string;
    family_code?: string;
    overdue_amount: number;
    overdue_count: number;
    days_overdue: number;
    oldest_due_label?: string;
  }>;
  attention_summary?: { count: number; total_overdue_amount: number };
  recent_activity?: Array<{
    id: string;
    type: string;
    family_id?: string;
    family_name?: string;
    family_code?: string;
    payer_name?: string;
    amount: number;
    method?: string;
    date?: string;
    receipt_number?: string;
    status?: string;
  }>;
  active_project_summaries?: Array<{
    project_id: string;
    name: string;
    code: string;
    target_amount: number;
    collected: number;
    remaining: number;
    funding_percentage: number;
  }>;
  tenant_context?: {
    tenant_id: number;
    name: string;
    tier: string;
    currency_code?: string;
    supports_child_rollup?: boolean;
  };
  persona?: DashboardPersona;
  saved_views?: DonationSavedViewPreset[];
}

export interface CollectionHealthPayload {
  score: number;
  max_score: number;
  label: string;
  status: 'healthy' | 'attention' | 'risk';
  status_label: string;
  summary: string;
  trend_pct: number;
  trend_direction: 'up' | 'down';
  issue_count: number;
  primary_reason: string;
  secondary_reason?: string | null;
  action_label: string;
  action_route: string;
  factors: Array<{
    key: string;
    label: string;
    score: number;
    weight_pct: number;
    status: 'healthy' | 'attention' | 'risk';
    trend_pct?: number | null;
    trend_direction?: 'up' | 'down' | null;
  }>;
  issues: Array<{
    severity: 'critical' | 'warning' | 'normal';
    message: string;
    detail?: string | null;
    cta_route: string;
  }>;
  recommended_actions: Array<{ id: string; label: string; route: string }>;
  insights: string[];
}

export interface FinancialCommandCenterPayload {
  meta: {
    church_name: string;
    financial_year?: string | null;
    currency_code?: string;
    period?: string;
    last_synced_at?: string;
    operator_name?: string;
    operator_role?: string;
  };
  health_index: FinancialHealthScore & { ai_summary?: string };
  collection_health: CollectionHealthPayload;
  health_scores?: DashboardHealthScores;
  executive_cards: Array<{
    key: string;
    label: string;
    value: number;
    trend_pct?: number | null;
    trend_direction?: 'up' | 'down' | null;
    comparison_period: string;
    context_message: string;
  }>;
  action_center: Array<{
    key: string;
    priority: string;
    title: string;
    affected_count: number;
    expected_amount: number;
    summary: string;
    suggested_actions: string[];
    cta_route: string;
  }>;
  analytics: {
    collection_trend: Array<{ period: string; label: string; collected: number }>;
    collection_performance_chart?: CollectionPerformanceChart;
    family_engagement: {
      active_contributors: number;
      inactive_families: number;
      participation_rate: number;
      contributing_families_delta: number;
    };
    project_funding: DonationDashboardSummary['active_project_summaries'];
    geographic: {
      by_bcc: Array<{ area_id?: string; area_name: string; collected: number; family_count: number; participation_density: number }>;
      by_city: Array<{ area_name: string; collected: number; family_count: number; participation_density: number }>;
    };
  };
  intelligence: Array<{
    type: string;
    title: string;
    subtitle: string;
    amount?: number;
    date?: string | null;
    reference?: string | null;
  }>;
  ai_advisor: {
    insights: ProactiveInsight[];
    forecast_narrative?: string | null;
    narratives?: string[];
    recommended_actions: string[];
  };
  contribution_intelligence: {
    top_contributors: Array<{ family_id: string; family_name?: string; family_code?: string; total_paid: number; payment_count: number }>;
    recent_contributors: Array<{ family_id: string; family_name?: string; family_code?: string; amount: number; payment_date?: string }>;
    largest_gifts?: Array<{ family_id: string; family_name?: string; family_code?: string; amount: number; payment_date?: string }>;
    returning_families?: Array<{ family_id: string; family_name?: string; family_code?: string }>;
    giving_streaks?: Array<{ family_id: string; family_name?: string; family_code?: string; consecutive_months: number }>;
  };
  collections_command: {
    today_count: number;
    today_collected: number;
    families_processed_today: number;
    target: number;
    completion_pct: number;
  };
  projects_command: Array<{
    project_id: string;
    name: string;
    code?: string;
    target_amount: number;
    collected: number;
    funding_gap: number;
    funding_percentage: number;
    risk_level: string;
    status: string;
  }>;
  communication_center: {
    whatsapp_queued: number;
    whatsapp_sent: number;
    whatsapp_failed: number;
    families_awaiting_follow_up: number;
    recent_messages?: unknown[];
  };
  expense_summary: {
    month_total: number;
    annual_total: number;
    expense_ratio_pct: number;
    recent: Array<{ id: string; category: string; amount: number; expense_date?: string }>;
  };
  kpis?: DashboardKpis;
  totals?: DonationDashboardSummary['totals'];
  period_collections?: DonationDashboardSummary['period_collections'];
  tenant_context?: DonationDashboardSummary['tenant_context'];
  persona?: DashboardPersona;
  saved_views?: DonationSavedViewPreset[];
}

export interface ParishExpenseRecord {
  id: string;
  category: string;
  amount: number;
  currency?: string;
  expense_date?: string;
  payee?: string | null;
  method?: string;
  notes?: string | null;
  status?: string;
}

export interface OperationsDashboardSummary {
  persona?: DashboardPersona;
  financial?: {
    health?: FinancialHealthScore;
    totals?: {
      collected: number;
      pending_dues: number;
      current_month_collected: number;
      annual_collected: number;
    };
    families?: { active?: number; participation_rate?: number };
    attention_summary?: { count: number; total_overdue_amount: number };
  };
  families_requiring_attention?: Array<{
    family_id: string;
    family_name: string;
    family_code?: string;
    overdue_amount: number;
    days_overdue?: number;
  }>;
  recent_activity?: Array<Record<string, unknown>>;
  active_projects?: Array<Record<string, unknown>>;
  saved_views?: DonationSavedViewPreset[];
}

export interface FinancialActivityTimeline {
  subject_type: string;
  subject_id: string;
  count: number;
  events: FinancialTimelineEvent[];
}

export interface ExecutiveReportSummary {
  title: string;
  narrative: string;
  highlights: string[];
  recommended_actions: string[];
  metrics: Record<string, number | string | null>;
  forecast_narrative?: string;
}

export interface ParishComparisonReport {
  available: boolean;
  message?: string;
  title?: string;
  narrative?: string;
  highlights?: string[];
  consolidated?: Record<string, number>;
  financial_health?: FinancialHealthScore;
  parishes?: Array<{
    tenant_id: number;
    name: string;
    health_score: number;
    health_label: string;
    health_status: string;
    participation_rate: number;
    total_collected: number;
    pending_dues: number;
    current_month_collected: number;
  }>;
}

export interface FinancialAiStatus {
  global_llm_enabled: boolean;
  tenant_llm_enabled: boolean;
  llm_active: boolean;
  default_engine: string;
  whatsapp_business_enabled: boolean;
}

export interface DashboardPersona {
  persona: 'priest' | 'treasurer' | 'secretary' | 'diocese_officer' | 'admin';
  label: string;
  emphasis: string;
  sections: string[];
  default_dashboard_view?: 'local' | 'rollup';
  quick_actions?: Array<{ id: string; label: string }>;
}

export interface DashboardHealthScore {
  score: number;
  label: string;
  status: 'healthy' | 'attention' | 'risk';
  summary?: string;
}

export interface DashboardHealthScores {
  financial?: FinancialHealthScore;
  collection_performance?: DashboardHealthScore;
  family_engagement?: DashboardHealthScore;
  project_funding?: DashboardHealthScore;
}

export interface DashboardKpis {
  average_contribution: number;
  collection_growth_pct: number;
  plan_compliance_pct: number;
  contributing_families_delta: number;
  previous_month_collected: number;
}

export interface CollectionPerformanceChart {
  granularity: 'month' | 'quarter' | 'year';
  series: Array<{
    key: 'collected' | 'outstanding' | 'target' | string;
    label: string;
    points: Array<{ period: string; label: string; value: number }>;
  }>;
}

export interface ProactiveInsight {
  severity: 'opportunity' | 'risk' | 'info';
  title: string;
  body: string;
  action?: { label: string; section?: string };
}

export interface DonationSavedViewPreset {
  key: string;
  label: string;
  description: string;
  route?: string;
  dashboard_section?: string;
}

export interface DonationSavedViewResult {
  key: string;
  available: boolean;
  label: string;
  count: number;
  items: Array<Record<string, unknown>>;
  message?: string;
}

export interface FinancialSearchResultItem {
  type: 'family' | 'project' | 'campaign' | 'receipt' | 'payment';
  id: string;
  title: string;
  subtitle?: string;
  route: string;
}

export interface FinancialGlobalSearchResult {
  query: string;
  total: number;
  groups: Array<{
    type: string;
    label: string;
    items: FinancialSearchResultItem[];
  }>;
}

export interface FinancialHealthScore {
  score: number;
  label: string;
  status: 'healthy' | 'attention' | 'risk';
  summary?: string;
  factors?: {
    punctuality?: number;
    mandatory_compliance?: number;
    project_participation?: number;
    voluntary_engagement?: number;
  };
  total_paid?: number;
  outstanding?: number;
}

export interface FinancialTimelineEvent {
  type: 'payment' | 'donation' | 'overdue' | 'receipt' | 'audit' | 'project';
  id: string;
  date?: string;
  title: string;
  subtitle?: string;
  amount?: number | null;
  reference?: string | null;
  status?: string;
}

export interface EngagementHeatmapCell {
  period?: string;
  label?: string;
  status: 'paid' | 'partial' | 'empty';
  total_paid: number;
}

export interface FamilyFundBreakdownRow {
  label: string;
  type: 'mandatory' | 'project';
  assigned: number;
  settled: number;
  remaining: number;
}

export interface UpiPaymentIntent {
  available: boolean;
  message?: string;
  upi_uri?: string;
  qr_data_uri?: string;
  vpa?: string;
  payee_name?: string;
  amount?: number;
  currency?: string;
  transaction_note?: string;
}

export interface FinancialAiResponse {
  intent: string;
  answer: string;
  engine?: string;
  match_score?: number;
  metrics?: Record<string, number>;
  families?: Array<Record<string, unknown>>;
  projects?: Array<Record<string, unknown>>;
  recommended_actions?: string[];
  examples?: string[];
  health?: FinancialHealthScore;
  totals?: DonationDashboardSummary['totals'];
  forecast?: CollectionForecast;
  outreach?: WhatsAppOutreachPreview;
  period_collections?: DonationDashboardSummary['period_collections'];
}

export interface CollectionForecast {
  method: string;
  narrative: string;
  history: Array<{ period: string; label: string; collected: number }>;
  signals: {
    moving_average_3m: number;
    current_month_collected: number;
    current_month_projection: number;
    collection_growth_pct: number;
    daily_pace: number;
  };
  projections: Array<{
    period: string;
    label: string;
    projected_collected: number;
    confidence: number;
  }>;
}

export interface ReceiptOcrResult {
  available: boolean;
  message?: string;
  confidence?: number;
  extracted_text?: string;
  suggested_amount?: number | null;
  suggested_payment_date?: string | null;
  suggested_payer_name?: string | null;
  suggested_method?: string | null;
}

export interface WhatsAppOutreachPreview {
  available: boolean;
  tenant_name?: string;
  eligible_count: number;
  template?: string;
  targets: Array<{
    family_id: string;
    family_name: string;
    family_code?: string;
    head_of_family?: string;
    phone?: string | null;
    overdue_amount: number;
    message: string;
    whatsapp_url?: string | null;
  }>;
}

export interface WhatsAppDeliverySummary {
  queued: number;
  sent: number;
  failed: number;
  business_api_enabled: boolean;
  recent: Array<{
    id: string;
    notification_type: string;
    recipient?: string | null;
    status: string;
    sent_at?: string | null;
    created_at?: string;
  }>;
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  total: number;
}

export interface ContributionPlan {
  id: string;
  fund_id: string;
  name: string;
  code: string;
  plan_type: 'uniform' | 'individual';
  frequency: string;
  custom_interval_days?: number | null;
  default_amount: number;
  start_date?: string | null;
  end_date?: string | null;
  grace_days?: number;
  auto_generate?: boolean;
  description?: string | null;
  status: string;
  fund?: { id: string; name: string; code: string };
  assignments_count?: number;
  dues_count?: number;
  assignments?: ContributionPlanAssignment[];
}

export interface ContributionPlanAssignment {
  id?: string;
  plan_id?: string;
  family_id: string;
  amount: number;
  effective_from: string;
  effective_to?: string | null;
  is_exempt?: boolean;
  status?: string;
  notes?: string | null;
  family?: { id: string; family_name: string; family_code?: string };
}

export interface ContributionDue {
  id: string;
  family_id: string;
  plan_id: string;
  period_label: string;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  outstanding_amount?: number;
  status: string;
  notes?: string | null;
  family?: { id: string; family_name: string; family_code?: string };
  plan?: { id: string; name: string; code: string; frequency?: string };
}

export interface PlanRevisionHistory {
  id: number;
  plan_id: string;
  family_id?: string | null;
  change_type: string;
  old_amount?: number | null;
  new_amount?: number | null;
  effective_from?: string | null;
  reason?: string | null;
  created_at: string;
}

export interface DonationFamilySummary {
  family_id: string;
  total_paid: number;
  pending_due: number;
  pending_mandatory_due?: number;
  pending_project_due?: number;
  overdue_count: number;
}

export interface FamilyContributionPlanSummary {
  plan_id: string;
  plan_name?: string;
  plan_code?: string;
  frequency?: string;
  plan_type?: string;
  assigned_amount: number;
  amount_paid: number;
  amount_pending: number;
  outstanding_balance: number;
  installment_count: number;
  next_due_date?: string | null;
  overdue_count: number;
  status: 'active' | 'completed' | 'overdue' | 'inactive' | string;
  is_exempt?: boolean;
  effective_from?: string | null;
  effective_to?: string | null;
}

export interface DonationFamilyFinancialProfile {
  family_id: string;
  financial_year?: string;
  currency?: string;
  financial_health?: FinancialHealthScore;
  financial_timeline?: FinancialTimelineEvent[];
  engagement_heatmap?: EngagementHeatmapCell[];
  fund_breakdown?: FamilyFundBreakdownRow[];
  totals: {
    total_paid: number;
    mandatory_paid?: number;
    project_paid?: number;
    voluntary_paid?: number;
    pending_due: number;
    pending_mandatory_due: number;
    pending_project_due: number;
    overdue_count: number;
    overdue_amount?: number;
    net: number;
    voluntary_collected?: number;
  };
  mandatory_contributions?: {
    assignments: Array<{
      plan_id: string;
      plan_name?: string;
      assigned_amount?: number | null;
      is_exempt?: boolean;
      frequency?: string;
    }>;
    plan_summaries?: FamilyContributionPlanSummary[];
    contribution_plans?: FamilyContributionPlanSummary[];
    contribution_plan_totals?: {
      total_commitment: number;
      total_paid: number;
      total_outstanding: number;
      active_plans_count: number;
    };
    outstanding_dues: Array<ContributionDue & { is_overdue?: boolean }>;
    overdue_dues?: Array<ContributionDue & { is_overdue?: boolean }>;
    totals?: {
      assigned: number;
      paid: number;
      pending: number;
      overdue_amount: number;
      overdue_count: number;
    };
  };
  project_contributions?: {
    projects: Array<{
      project_id: string;
      project_name: string;
      project_code: string;
      target_amount: number;
      amount_collected: number;
      outstanding_amount: number;
      installment_outstanding: number;
      completion_percentage: number;
      status: string;
      installment_status?: {
        total: number;
        paid: number;
        pending: number;
        overdue: number;
      };
    }>;
    outstanding_installments: Array<{
      id: string;
      project_name?: string;
      installment_label: string;
      due_date: string;
      outstanding_amount: number;
      status: string;
      is_overdue?: boolean;
    }>;
    installment_ledger?: Array<{
      id: string;
      project_name?: string;
      installment_label: string;
      due_date: string;
      amount_due: number;
      amount_paid: number;
      outstanding_amount: number;
      status: string;
      is_overdue?: boolean;
    }>;
    totals: {
      target_total: number;
      collected: number;
      outstanding: number;
      installment_outstanding: number;
    };
  };
  donations_offerings?: {
    lifetime_collected: number;
    current_financial_year_collected: number;
    financial_year?: string;
    last_donation_date?: string | null;
    pledged_outstanding: number;
    entry_count?: number;
    by_category?: Array<{ category_id?: string | null; category_name: string; collected: number }>;
    recent_donations?: Array<{
      id: string;
      title?: string;
      category?: string;
      donor?: string;
      status: string;
      pledged_amount: number;
      collected_amount: number;
      received_at?: string;
      is_anonymous?: boolean;
    }>;
  };
  voluntary_donations?: {
    totals: {
      collected: number;
      pledged_outstanding: number;
      entries: number;
    };
    recent_donations: Array<{
      id: string;
      title?: string;
      category?: string;
      donor?: string;
      status: string;
      pledged_amount: number;
      collected_amount: number;
      received_at?: string;
      is_anonymous?: boolean;
    }>;
  };
  payment_history?: {
    recent: FamilyPaymentLedgerEntry[];
    ledger: FamilyPaymentLedgerEntry[];
    total_transactions: number;
  };
  outstanding_balances?: {
    mandatory: number;
    mandatory_overdue: number;
    project: number;
    project_installments: number;
    voluntary_pledged: number;
    total: number;
  };
  analytics?: FamilyFinancialAnalytics;
  ai_insights?: string[];
  recommended_actions?: string[];
  recent_payments?: FamilyPaymentLedgerEntry[];
  outstanding_dues?: Array<ContributionDue & { is_overdue?: boolean }>;
}

export interface DonationNotificationLog {
  id: string;
  notification_type: string;
  channel: string;
  recipient?: string | null;
  target_type?: string | null;
  target_id?: string | null;
  status: string;
  payload?: Record<string, unknown>;
  sent_at?: string | null;
  error_message?: string | null;
  created_at?: string;
}

export interface FamilyPaymentLedgerEntry {
  id: string;
  payment_number: string;
  payer_name: string;
  payment_date: string;
  amount: number;
  method: string;
  status: string;
  source_type?: string;
  is_anonymous?: boolean;
  receipt_id?: string;
  receipt_number?: string;
  allocations?: Array<{ allocatable_type: string; allocatable_id: string; amount: number }>;
}

export interface FamilyFinancialAnalytics {
  trend: Array<{
    period: string;
    label: string;
    mandatory_paid: number;
    project_paid: number;
    voluntary_paid: number;
    total_paid: number;
  }>;
  punctuality: {
    score: number;
    evaluated_periods: number;
    paid_on_time: number;
    overdue_open: number;
    partially_paid_late: number;
    label: string;
  };
  ranking: {
    by_total_giving: number;
    participating_families: number;
    active_families: number;
    percentile: number;
    total_paid: number;
  };
  comparison: {
    tenant_average_giving: number;
    tenant_median_giving: number;
    family_total_giving: number;
    vs_average_pct: number;
    vs_median_pct: number;
    family_mandatory_pending: number;
    tenant_average_mandatory_pending: number;
  };
}

export interface DonationPayment {
  id: string;
  payment_number: string;
  payer_name: string;
  payment_date: string;
  amount: number;
  method: string;
  status: string;
  is_anonymous?: boolean;
  source_type?: string;
  created_at?: string;
  family?: { id: string; family_name: string; family_code?: string };
}

export interface DonationReportExport {
  id: string;
  report_type: string;
  status: string;
  file_path?: string;
  created_at: string;
}

export interface DonationCategory {
  id: string;
  name: string;
  code: string;
  description?: string;
  is_tax_deductible?: boolean;
  active: boolean;
}

export interface Donor {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  donor_type?: string;
  is_anonymous?: boolean;
  family_id?: string;
}

export interface DonationEntry {
  id: string;
  title?: string;
  pledged_amount: number;
  collected_amount: number;
  status: string;
  financial_year?: string;
  is_anonymous?: boolean;
  donation_category_id?: string;
  donor_id?: string;
  family_id?: string;
  category?: DonationCategory;
  donor?: Donor;
}

export interface DonationSettings {
  id: string;
  default_currency: string;
  tax_registration_number?: string;
  tax_acknowledgement_note?: string;
  receipt_prefix: string;
  receipt_prefix_enabled: boolean;
  metadata?: Record<string, unknown>;
}

export interface PaymentBatch {
  id: string;
  batch_number: string;
  batch_date: string;
  status: string;
  payments_count: number;
  total_amount: number;
}

export interface RecurringDonationSchedule {
  id: string;
  donor_id?: string;
  family_id?: string;
  donation_category_id?: string;
  amount: number;
  currency?: string;
  frequency: string;
  next_run_on: string;
  end_on?: string;
  status: string;
}

export interface DonationAuditLog {
  id: number;
  created_at: string;
  category: string;
  icon: string;
  title: string;
  description: string;
  subject_name?: string | null;
  actor_name: string;
  amount?: number | null;
  currency?: string | null;
  action_label?: string | null;
  action_path?: string | null;
  requires_attention?: boolean;
}

export interface DioceseRollupDashboard {
  available: boolean;
  message?: string;
  root?: {
    tenant_id: number;
    name: string;
    tier: string;
    hierarchy_path?: string;
    child_count?: number;
    currency_code?: string;
  };
  scope?: {
    tenant_count: number;
    parish_count: number;
  };
  financial_health?: FinancialHealthScore;
  consolidated?: {
    total_collected: number;
    pending_dues: number;
    overdue_amount: number;
    current_month_collected: number;
    collection_growth_pct: number;
    active_families: number;
    participating_families: number;
    active_projects: number;
  };
  collection_trend?: Array<{ period: string; label: string; collected: number }>;
  parishes?: Array<{
    tenant_id: number;
    name: string;
    tier: string;
    participation_rate: number;
    health_score: number;
    health_status: string;
    health_label: string;
    metrics: {
      total_collected: number;
      pending_dues: number;
      current_month_collected: number;
      active_families: number;
    };
  }>;
}

export interface DonationReceiptListItem {
  id: string;
  receipt_number: string;
  issued_on?: string;
  is_void?: boolean;
  payment_id?: string;
  payment_number?: string;
  payer_name?: string;
  amount: number;
  payment_date?: string;
  method?: string;
  status?: string;
  family_id?: string;
  family_name?: string;
  family_code?: string;
}

export interface DonationReceiptPreview {
  receipt: { receipt_number: string; issued_on: string };
  payer: { name: string; email?: string | null; is_anonymous?: boolean };
  tax_acknowledgement: {
    registration_number?: string;
    note?: string;
    tax_deductible_amount: number;
    has_tax_deductible_portion: boolean;
  };
  totals: { amount: number; currency: string };
  line_items: Array<{ description: string; amount: number; is_tax_deductible?: boolean }>;
}

export interface DonationProject {
  id: string;
  fund_id?: string | null;
  name: string;
  code: string;
  entity_kind?: 'project' | 'campaign';
  campaign_type?: 'building' | 'charity' | 'event' | 'general' | null;
  assignment_mode: 'uniform' | 'individual' | 'uniform_with_exceptions';
  description?: string | null;
  target_amount: number;
  default_family_target: number;
  raised_amount: number;
  start_date?: string | null;
  end_date?: string | null;
  installment_count?: number;
  installment_frequency?: string | null;
  installment_interval_days?: number | null;
  auto_generate_installments?: boolean;
  status: string;
  collection_percentage?: number;
  families_enrolled?: number;
  fund?: { id: string; name: string; code: string };
  assignments_count?: number;
  installment_dues_count?: number;
  assignments?: ProjectFamilyAssignment[];
}

export interface ProjectFamilyAssignment {
  id?: string;
  project_id?: string;
  family_id: string;
  target_amount?: number | null;
  amount_collected?: number;
  is_exempt?: boolean;
  effective_from: string;
  effective_to?: string | null;
  status?: string;
  notes?: string | null;
  family?: { id: string; family_name: string; family_code?: string };
}

export interface ProjectInstallmentDue {
  id: string;
  project_id: string;
  family_id: string;
  installment_number: number;
  installment_label: string;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  outstanding_amount?: number;
  status: string;
  family?: { id: string; family_name: string };
  project?: { id: string; name: string; code: string };
}

export interface ProjectDashboard {
  project: DonationProject;
  totals: {
    overall_target: number;
    family_target_total: number;
    collected: number;
    outstanding: number;
    installment_outstanding: number;
    collection_percentage: number;
  };
  families: {
    enrolled: number;
    completed: number;
    partial: number;
    exempt: number;
  };
  family_progress: Array<{
    family_id: string;
    target_amount: number;
    amount_collected: number;
    outstanding_amount: number;
    completion_percentage: number;
  }>;
  installments: {
    total: number;
    paid: number;
    pending: number;
  };
}
