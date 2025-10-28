/**
 * Diocese/Archdiocese Model
 * Represents ecclesiastical dioceses and archdioceses
 */

export interface Diocese {
  id: number;
  name: string;
  code?: string;
  denomination_id: number;
  denomination?: {
    id: number;
    name: string;
  };
  country_id: number;
  country?: {
    id: number;
    name: string;
  };
  state_id?: number;
  state?: {
    id: number;
    name: string;
  };
  is_archdiocese: boolean;
  website?: string;
  address_line1?: string;
  city?: string;
  postal_code?: string;
  phone?: string;
  email?: string;
  established_date?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DioceseCreateRequest {
  name: string;
  code?: string;
  denomination_id: number;
  country_id: number;
  state_id?: number;
  is_archdiocese?: boolean;
  website?: string;
  address_line1?: string;
  city?: string;
  postal_code?: string;
  phone?: string;
  email?: string;
  established_date?: string;
  active?: boolean;
}

export interface DioceseUpdateRequest extends Partial<DioceseCreateRequest> {
  id: number;
}

export interface DioceseListParams {
  page?: number;
  per_page?: number;
  search?: string;
  country_id?: number;
  denomination_id?: number;
  is_active?: boolean;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface DioceseStatistics {
  total_dioceses: number;
  active_dioceses: number;
  by_country: Array<{ country: string; total: number }>;
  by_denomination: Array<{ denomination: string; total: number }>;
}

