/**
 * Sacrament Type Model
 * Master data for sacrament types managed by Ekklesia users
 */

export interface SacramentType {
  id: number;
  name: string;
  code: string;
  description?: string;
  category: 'initiation' | 'healing' | 'service' | 'other';
  theological_significance?: string;
  requires_minister: boolean;
  minister_type?: string;
  repeatable: boolean;
  min_age_years?: number;
  typical_age_years?: number;
  display_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SacramentTypeCreateRequest {
  name: string;
  code: string;
  description?: string;
  category: 'initiation' | 'healing' | 'service' | 'other';
  theological_significance?: string;
  requires_minister?: boolean;
  minister_type?: string;
  repeatable?: boolean;
  min_age_years?: number;
  typical_age_years?: number;
  display_order?: number;
  active?: boolean;
}

export interface SacramentTypeUpdateRequest {
  name?: string;
  code?: string;
  description?: string;
  category?: 'initiation' | 'healing' | 'service' | 'other';
  theological_significance?: string;
  requires_minister?: boolean;
  minister_type?: string;
  repeatable?: boolean;
  min_age_years?: number;
  typical_age_years?: number;
  display_order?: number;
  active?: boolean;
}

export interface SacramentTypeListParams {
  search?: string;
  active?: boolean;
  category?: string;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
  per_page?: number | 'all';
  page?: number;
}

export interface SacramentTypeStatistics {
  total: number;
  active: number;
  inactive: number;
  by_category: Array<{
    category: string;
    count: number;
  }>;
}

export const SACRAMENT_CATEGORIES = [
  { value: 'initiation', label: 'Sacraments of Initiation' },
  { value: 'healing', label: 'Sacraments of Healing' },
  { value: 'service', label: 'Sacraments of Service' },
  { value: 'other', label: 'Other' }
];

export const MINISTER_TYPES = [
  { value: 'Priest', label: 'Priest' },
  { value: 'Bishop', label: 'Bishop' },
  { value: 'Deacon', label: 'Deacon' },
  { value: 'Any Baptized Person', label: 'Any Baptized Person' },
  { value: 'Spouses', label: 'Spouses (for Matrimony)' }
];


