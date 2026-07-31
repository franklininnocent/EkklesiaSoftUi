/**
 * Sacrament Models and Interfaces
 * Represents sacramental records and related entities
 */

import { SacramentStatus, Gender, ChurchType } from '../constants/sacrament.constants';

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
  recipient_name: string;
  date_administered: string;
  place_administered?: string;
  minister_name?: string;
  minister_title?: string;
  certificate_number?: string;
  book_number?: string;
  page_number?: string;
  recipient_birth_date?: string;
  recipient_birth_place?: string;
  recipient_gender?: 'male' | 'female' | 'other';
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
}

export interface SacramentCreateRequest {
  tenant_id: number;
  family_id?: string | null;
  bcc_id?: string | null;
  sacrament_type_id: number;
  recipient_name: string;
  date_administered: string;
  place_administered?: string;
  minister_name?: string;
  minister_title?: string;
  certificate_number?: string;
  book_number?: string;
  page_number?: string;
  recipient_birth_date?: string;
  recipient_birth_place?: string;
  recipient_gender?: 'male' | 'female' | 'other';
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


