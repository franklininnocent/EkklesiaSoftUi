export interface TenantDataExportModule {
  key: string;
  label: string;
  default_selected: boolean;
  estimated_records: number;
}

export type TenantDataExportStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'expired'
  | 'cancelled';

export interface TenantDataExportProgressModule {
  status: string;
  records: number;
}

export interface TenantDataExportProgress {
  modules?: Record<string, TenantDataExportProgressModule>;
  approx_percent?: number;
}

export interface TenantDataExport {
  id: string;
  tenant_id: number;
  modules: string[];
  options?: {
    include_media?: boolean;
    format?: string;
  };
  status: TenantDataExportStatus;
  progress?: TenantDataExportProgress | null;
  record_counts?: Record<string, number> | null;
  record_count_total?: number;
  file_size?: number | null;
  error_message?: string | null;
  requested_by?: number | null;
  requested_by_name?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  expires_at?: string | null;
  download_count?: number;
  downloadable: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface TenantDataExportListPayload {
  data: TenantDataExport[];
  current_page?: number;
  last_page?: number;
  per_page?: number;
  total?: number;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
}
