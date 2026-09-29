/**
 * Leadership Report drill-down identifiers — must stay aligned with
 * {@link ReportMetricCatalog} / API registry (server is authoritative).
 */
export const REPORT_DRILL_DOWN_GRAPH_IDS = [
  'outstanding_overdue',
  'collections',
  'collection_snapshot',
  'collection_trend',
  'family_participation',
  'month_end_forecast',
  'financial_health'
] as const;

export type ReportDrillDownGraphIdConstant = (typeof REPORT_DRILL_DOWN_GRAPH_IDS)[number];
