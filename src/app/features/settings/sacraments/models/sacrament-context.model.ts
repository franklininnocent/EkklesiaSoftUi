export type SacramentRecordStatus =
  | 'FOUND'
  | 'NOT_FOUND'
  | 'NOT_SEARCHED'
  | 'NOT_APPLICABLE'
  | 'ACCESS_DENIED'
  | 'ERROR'
  | 'MULTIPLE_CANDIDATES';

export type SacramentFieldState =
  | 'CANONICAL'
  | 'READ_ONLY_VERIFIED'
  | 'DERIVED'
  | 'EDITABLE'
  | 'USER_ENTERED'
  | 'MISSING'
  | 'CONFLICT'
  | 'MULTIPLE_CANDIDATES';

export type SacramentConflictSeverity = 'INFO' | 'WARNING' | 'REVIEW_REQUIRED' | 'BLOCKING';

export interface SacramentFieldProvenance {
  source_type: string | null;
  source_id?: string | null;
  source_label?: string | null;
  evidence_type?: string | null;
  verification_status?: string | null;
  record_status?: SacramentRecordStatus | null;
  derived_from?: string | null;
}

export interface SacramentContextField<T = unknown> {
  value: T;
  field_state: SacramentFieldState;
  provenance: SacramentFieldProvenance;
}

export interface SacramentContextConflict {
  field: string;
  label: string;
  severity: SacramentConflictSeverity;
  blocks_save: boolean;
  candidates: Array<{
    value: string;
    source_type: string;
    source_label: string;
    source_id?: string | null;
  }>;
}

export interface SacramentEvidenceSummary {
  sacrament_id: string | number;
  date?: SacramentContextField<string | null>;
  place?: SacramentContextField<string | null>;
  parish?: SacramentContextField<string | null>;
  register?: {
    book_number?: string | null;
    page_number?: string | null;
    registry_entry?: string | null;
    certificate_number?: string | null;
  };
  recipient_name?: string | null;
  recipient_birth_date?: string | null;
  father_name?: string | null;
  mother_name?: string | null;
}

export interface SacramentSacramentEvidenceBlock {
  record_status: SacramentRecordStatus;
  register_record_status?: SacramentRecordStatus;
  evidence_tier?: string | null;
  candidates: SacramentEvidenceSummary[];
  evidence?: SacramentEvidenceSummary | null;
}

export interface SacramentContextResponse {
  subject: {
    person_id?: string | null;
    family_member_id?: string | null;
    display_name?: string | null;
    participant_role?: string | null;
  };
  canonical_identity: {
    name: SacramentContextField<string | null>;
    date_of_birth: SacramentContextField<string | null>;
    gender: SacramentContextField<string | null>;
    father_name: SacramentContextField<string | null>;
    mother_name: SacramentContextField<string | null>;
  };
  family: {
    record_status: SacramentRecordStatus;
    data?: Record<string, unknown> | null;
  };
  parish: {
    record_status: SacramentRecordStatus;
    data?: Record<string, unknown> | null;
  };
  sacraments: {
    baptism: SacramentSacramentEvidenceBlock;
    confirmation: SacramentSacramentEvidenceBlock;
    marriage_history: {
      record_status: SacramentRecordStatus;
      records: SacramentEvidenceSummary[];
    };
  };
  derived: {
    baptismal_status?: SacramentContextField<string | null>;
  };
  fields: Record<string, {
    required: boolean;
    visible: boolean;
    input_hidden: boolean;
    field_state: SacramentFieldState;
    auto_resolved: boolean;
  }>;
  conflicts: SacramentContextConflict[];
  has_blocking_conflicts: boolean;
  missing: Array<{ field: string; classification: string; label: string }>;
  found_summary: string[];
  record_status: Record<string, SacramentRecordStatus>;
}

export interface SacramentContextQuery {
  family_member_id?: string;
  person_id?: string;
  workflow: string;
  participant_role?: string;
  sacrament_id?: number;
}

export interface PersonIdentityReconcileRequest {
  field: string;
  new_value?: string;
  source_selected?: string;
  reason: string;
  name_parts?: {
    first_name?: string;
    middle_name?: string;
    last_name?: string;
  };
}
