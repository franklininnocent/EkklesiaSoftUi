/**
 * Sacrament Models and Interfaces
 * Represents sacramental records and related entities
 */

import { SacramentStatus, Gender, ChurchType } from '../constants/sacrament.constants';

/** Participant row posted on create/correct (Phase 3+ / Phase 6 Baptism). */
export interface SacramentParticipantPayload {
  role: string;
  source: 'member' | 'person' | 'internal_leadership' | 'external';
  sort_order?: number;
  family_member_id?: string | null;
  person_id?: string | null;
  church_leadership_id?: number | null;
  external_full_name?: string;
  external_date_of_birth?: string;
  external_gender?: 'male' | 'female' | 'other';
  external_address?: string;
  external_contact_number?: string;
  external_title?: string;
  external_minister_role?: string;
  affiliation_type?: 'home_parish' | 'other' | null;
  affiliation_parish_name?: string;
  affiliation_parish_address?: string;
  affiliation_diocese_name?: string;
  affiliation_diocese_region?: string;
  affiliation_diocese_country?: string;
}

/** Participant row returned when participants_v1 is enabled. */
export interface SacramentParticipant {
  id?: number;
  role: string;
  source: string;
  family_member_id?: string | null;
  person_id?: string | null;
  church_leadership_id?: number | null;
  sort_order?: number;
  external_full_name?: string | null;
  external_date_of_birth?: string | null;
  external_gender?: 'male' | 'female' | 'other' | string | null;
  external_address?: string | null;
  external_contact_number?: string | null;
  affiliation_type?: string | null;
  affiliation_parish_name?: string | null;
  affiliation_diocese_name?: string | null;
  snapshot_json?: {
    full_name?: string;
    gender?: string;
    address?: string;
    contact_number?: string;
    [key: string]: unknown;
  } | null;
}

export interface SacramentType {
  id: number;
  name: string;
  code: string;
  category: 'initiation' | 'healing' | 'service';
  description?: string;
  theological_significance?: string;
  display_order: number;
  min_age_years?: number;
  typical_age_years?: number;
  repeatable: boolean;
  requires_minister: boolean;
  minister_type?: string;
  active: boolean;
  enabled_for_tenant?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Sacrament {
  id: number;
  tenant_id: number;
  family_id?: string | null;
  bcc_id?: string | null;
  sacrament_type_id: number;
  sacrament_type?: SacramentType;
  event_subtype?: string | null;
  place_classification?: string | null;
  typed_attributes?: Record<string, string | null> | null;
  recipient_name: string;
  date_administered: string;
  place_administered?: string;
  minister_name?: string;
  minister_title?: string;
  certificate_number?: string;
  book_number?: string;
  page_number?: string;
  registry_entry?: string;
  recipient_birth_date?: string;
  recipient_birth_place?: string;
  recipient_gender?: 'male' | 'female' | 'other';
  baptism_date?: string;
  father_name?: string;
  mother_name?: string;
  godparent1_name?: string;
  godparent2_name?: string;
  marriage_bride_full_name?: string;
  marriage_bride_father_name?: string;
  marriage_bride_mother_name?: string;
  marriage_bride_address?: string;
  marriage_bride_church_type?: 'home_parish' | 'other';
  marriage_bride_church_name?: string;
  marriage_bride_church_address?: string;
  marriage_groom_full_name?: string;
  marriage_groom_father_name?: string;
  marriage_groom_mother_name?: string;
  marriage_groom_address?: string;
  marriage_groom_church_type?: 'home_parish' | 'other';
  marriage_groom_church_name?: string;
  marriage_groom_church_address?: string;
  witnesses?: string;
  notes?: string;
  document_path?: string;
  status: SacramentStatus;
  conditional_date?: string;
  conditional_reason?: string;
  created_by?: number;
  updated_by?: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  participants?: SacramentParticipant[];
  lock_version?: number;
}

export interface SacramentCreateRequest {
  tenant_id: number;
  family_id?: string | null;
  person_id?: string | null;
  family_member_id?: string | null;
  family_association?: 'none' | 'existing' | 'new' | null;
  acknowledge_person_match?: boolean;
  use_person_id?: string;
  relationship_to_head?: string;
  person?: {
    first_name: string;
    middle_name?: string;
    last_name: string;
    date_of_birth?: string;
    place_of_birth?: string;
    gender?: 'male' | 'female' | 'other';
    father_name?: string;
    mother_name?: string;
    phone?: string;
    email?: string;
    address_line_1?: string;
    address_line_2?: string;
    city?: string;
    postal_code?: string;
  };
  family?: {
    family_name: string;
    head_of_family?: string;
    address_line_1?: string;
    address_line_2?: string;
    city?: string;
    postal_code?: string;
    bcc_id?: string;
  };
  bcc_id?: string | null;
  sacrament_type_id: number;
  event_subtype?: string;
  place_classification?: string;
  typed_attributes?: {
    ordination_type?: string;
    diocese_name?: string;
    place_detail?: string;
  };
  recipient_name: string;
  date_administered: string;
  place_administered?: string;
  minister_name?: string;
  minister_title?: string;
  certificate_number?: string;
  book_number?: string;
  page_number?: string;
  registry_entry?: string;
  recipient_birth_date?: string;
  recipient_birth_place?: string;
  recipient_gender?: 'male' | 'female' | 'other';
  baptism_date?: string;
  father_name?: string;
  mother_name?: string;
  godparent1_name?: string;
  godparent2_name?: string;
  participants?: SacramentParticipantPayload[];
  acknowledge_duplicate_warning?: boolean;
  marriage_bride_full_name?: string;
  marriage_bride_father_name?: string;
  marriage_bride_mother_name?: string;
  marriage_bride_address?: string;
  marriage_bride_church_type?: 'home_parish' | 'other';
  marriage_bride_church_name?: string;
  marriage_bride_church_address?: string;
  marriage_groom_full_name?: string;
  marriage_groom_father_name?: string;
  marriage_groom_mother_name?: string;
  marriage_groom_address?: string;
  marriage_groom_church_type?: 'home_parish' | 'other';
  marriage_groom_church_name?: string;
  marriage_groom_church_address?: string;
  witnesses?: string;
  notes?: string;
  status?: SacramentStatus;
  conditional_date?: string;
  conditional_reason?: string;
}

export interface SacramentUpdateRequest extends Partial<SacramentCreateRequest> {
  id: number;
}

export interface SacramentListParams {
  page?: number;
  per_page?: number;
  tenant_id?: number;
  sacrament_type_id?: number;
  status?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  minister_name?: string;
  certificate_number?: string;
  book_number?: string;
  family_id?: string;
  bcc_id?: string;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
}

export interface SacramentResponse {
  success: boolean;
  data: Sacrament;
  message?: string;
}

/** Issued / preview certificate (Phase 8). storage_key never exposed. */
export interface SacramentCertificate {
  id: number;
  sacrament_id: number;
  certificate_number?: string | null;
  certificate_type?: string | null;
  status: 'draft_preview' | 'issued' | 'superseded' | 'voided';
  version: number;
  language?: string | null;
  locale?: string | null;
  template_code?: string | null;
  template_version?: string | null;
  issued_at?: string | null;
  issued_by?: number | null;
  checksum?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  has_file?: boolean;
  projection?: Record<string, unknown> | null;
  supersedes_certificate_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface SacramentCertificateResponse {
  success: boolean;
  data: SacramentCertificate;
  message?: string;
}

export interface SacramentCertificateListResponse {
  success: boolean;
  data: SacramentCertificate[];
  message?: string;
}

export interface SacramentListResponse {
  success: boolean;
  data: {
    data: Sacrament[];
    current_page: number;
    from: number;
    last_page: number;
    per_page: number;
    to: number;
    total: number;
  };
  message?: string;
}

export interface SacramentTypeResponse {
  success: boolean;
  data: SacramentType[];
  message?: string;
}


