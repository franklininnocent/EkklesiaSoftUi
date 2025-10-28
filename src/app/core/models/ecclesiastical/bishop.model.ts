/**
 * Bishop Model
 * Represents bishops, archbishops, and other church leadership
 */

export interface Bishop {
  id: number;
  full_name: string;
  given_name?: string;
  family_name?: string;
  religious_name?: string;
  birth_name?: string;
  archdiocese_id: number;
  archdiocese?: {
    id: number;
    name: string;
    is_archdiocese?: boolean;
  };
  ecclesiastical_title_id?: number;
  ecclesiastical_title?: {
    id: number;
    name: string;
  };
  religious_order_id?: number;
  religious_order?: {
    id: number;
    name: string;
    abbreviation?: string;
  };
  appointed_date?: string;
  ordained_priest_date?: string;
  ordained_bishop_date?: string;
  retired_date?: string;
  retirement_date?: string;
  date_of_birth?: string;
  place_of_birth?: string;
  date_of_death?: string;
  nationality?: string;
  email?: string;
  phone?: string;
  photo_url?: string;
  education?: string;
  biography?: string;
  status: 'active' | 'retired' | 'deceased' | 'inactive';
  is_current: boolean;
  created_at: string;
  updated_at: string;
}

export interface BishopCreateRequest {
  full_name: string;
  given_name?: string;
  family_name?: string;
  religious_name?: string;
  archdiocese_id: number;
  ecclesiastical_title_id?: number;
  appointed_date?: string;
  ordained_priest_date?: string;
  ordained_bishop_date?: string;
  date_of_birth?: string;
  email?: string;
  phone?: string;
  photo_url?: string;
  education?: string;
  status?: 'active' | 'retired' | 'deceased' | 'inactive';
  is_current?: boolean;
}

export interface BishopUpdateRequest extends Partial<BishopCreateRequest> {
  id: number;
}

export interface BishopListParams {
  page?: number;
  per_page?: number;
  search?: string;
  diocese_id?: number;
  title_id?: number;
  is_active?: boolean;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
}

export interface BishopStatistics {
  total_bishops: number;
  active_bishops: number;
  by_title: Array<{ title: string; total: number }>;
  inactive: number;
}

