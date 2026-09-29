export type DefaultSeedStatus =
  | 'available'
  | 'partially_initialized'
  | 'initialized'
  | 'unavailable';

export type DefaultSeedResultStatus =
  | 'completed'
  | 'already_initialized'
  | 'partially_completed'
  | 'failed'
  | 'skipped'
  | 'unavailable';

export interface DefaultSeedCatalogItem {
  id: string;
  module: string;
  module_label: string;
  display_name: string;
  description: string;
  sort_order: number;
  depends_on: string[];
  required_permission: string;
  feature_key: string;
  execution_strategy: string;
  supports_preview: boolean;
  open_route: string;
  open_query?: Record<string, string> | null;
  expected_count: number;
  matched_count: number;
  missing_count: number;
  has_other_records: boolean;
  missing_names: string[];
  status: DefaultSeedStatus;
  impact: string;
  can_run?: boolean;
}

export interface DefaultSeedCatalogSummary {
  available: number;
  partially_initialized: number;
  initialized: number;
  total: number;
}

export interface DefaultSeedCatalogPayload {
  summary: DefaultSeedCatalogSummary;
  seeders: DefaultSeedCatalogItem[];
}

export interface DefaultSeedExecutionResult {
  id: string;
  display_name: string;
  result_status: DefaultSeedResultStatus;
  created_count: number;
  skipped_count: number;
  failed_count: number;
  message: string;
  dependencies: string[];
}

export interface DefaultSeedExecutionSummary {
  completed: number;
  already_initialized: number;
  partially_completed: number;
  failed: number;
  skipped: number;
  unavailable: number;
}

export interface DefaultSeedExecutionPayload {
  results: DefaultSeedExecutionResult[];
  summary: DefaultSeedExecutionSummary;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
}
