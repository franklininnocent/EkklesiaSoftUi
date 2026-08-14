/** Phase 9 — sacrament migration resolution queue. */

export type MigrationResolutionKind = 'member' | 'external' | 'unresolved';
export type MigrationConfidence = 'exact' | 'ambiguous' | 'none';

export interface SacramentMigrationResolution {
  id: number;
  tenant_id: number;
  legacy_sacrament_id: number;
  participant_role: string;
  legacy_name?: string | null;
  legacy_dob?: string | null;
  candidate_member_id?: string | null;
  candidate_member_name?: string | null;
  confidence: MigrationConfidence;
  resolution: MigrationResolutionKind;
  resolved_by?: number | null;
  resolved_at?: string | null;
  migration_key: string;
  sacrament?: {
    id: number;
    recipient_name?: string;
    date_administered?: string;
    sacrament_type_id?: number;
    status?: string;
  } | null;
}

export interface SacramentMigrationReport {
  total_resolutions: number;
  linked: number;
  unresolved: number;
  external: number;
  affiliation_incomplete: number;
  failed: number;
  sacraments_without_participants: number;
  unresolved_participants: number;
  participants_v1: boolean;
}

export interface SacramentMigrationListResponse {
  success: boolean;
  data: {
    data: SacramentMigrationResolution[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface SacramentMigrationReportResponse {
  success: boolean;
  data: SacramentMigrationReport;
}
