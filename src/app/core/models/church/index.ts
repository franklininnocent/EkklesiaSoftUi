/**
 * Church Management Models & Interfaces
 * 
 * Defines TypeScript interfaces for ecclesiastical data structures
 * aligned with the backend Laravel API models.
 */

/**
 * Denomination Model
 * Represents church denominations (Catholic, Protestant, Orthodox, etc.)
 */
export interface Denomination {
  id: number;
  name: string;
  code: string;
  description?: string;
  active: number;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Archdiocese Model
 * Represents ecclesiastical administrative regions
 */
export interface Archdiocese {
  id: number;
  name: string;
  code?: string;
  country: string;
  region?: string;
  headquarters_city?: string;
  denomination_id?: number;
  parent_archdiocese_id?: number;
  description?: string;
  website?: string;
  active: number;
  created_at?: string;
  updated_at?: string;
  // Relationships
  denomination?: Denomination;
  parent_archdiocese?: Archdiocese;
}

/**
 * Bishop Model
 * Information about bishops and overseers
 */
export interface Bishop {
  id: number;
  full_name: string;
  title: string;
  archdiocese_id?: number;
  ordained_date?: string;
  appointed_date?: string;
  email?: string;
  phone?: string;
  biography?: string;
  photo_url?: string;
  active: number;
  created_at?: string;
  updated_at?: string;
  // Relationships
  archdiocese?: Archdiocese;
  full_title?: string;
}

/**
 * Church Profile Model
 * Extended church information linked to tenant
 */
export interface ChurchProfile {
  id: number;
  tenant_id: number;
  denomination_id?: number;
  archdiocese_id?: number;
  bishop_id?: number;
  founded_year?: number;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  about?: string;
  vision?: string;
  mission?: string;
  core_values?: string;
  service_times?: string;
  patron_name?: string;
  patron_image_path?: string;
  patron_image_url?: string;
  created_at?: string;
  updated_at?: string;
  // Relationships
  denomination?: Denomination;
  archdiocese?: Archdiocese;
  bishop?: Bishop;
}

/**
 * Church Leadership Model
 * Pastors and ministry leaders
 */
export interface ChurchLeadership {
  id: number;
  tenant_id: number;
  full_name: string;
  role: string;
  title?: string;
  email?: string;
  phone?: string;
  appointed_date?: string;
  relieved_date?: string;
  start_date?: string;
  end_date?: string;
  biography?: string;
  photo_url?: string;
  is_primary: number;
  display_order: number;
  active: number;
  created_at?: string;
  updated_at?: string;
  full_title?: string;
}

/**
 * Church Statistic Model
 * Time-series data for church metrics
 */
export interface ChurchStatistic {
  id: number;
  tenant_id: number;
  year: number;
  month?: number;
  membership_count?: number;
  weekly_attendance?: number;
  baptisms?: number;
  confirmations?: number;
  marriages?: number;
  funerals?: number;
  tithes_offerings?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  period?: string; // Formatted period string
}

/**
 * Church Social Media Model
 * Social media accounts
 */
export interface ChurchSocialMedia {
  id: number;
  tenant_id: number;
  platform: 'facebook' | 'twitter' | 'instagram' | 'youtube' | 'linkedin' | 'tiktok' | 'whatsapp';
  url: string;
  username?: string;
  follower_count?: number;
  is_primary: number;
  display_order: number;
  active: number;
  created_at?: string;
  updated_at?: string;
  platform_icon?: string;
  platform_color?: string;
}

/**
 * API Response Wrappers
 */
export interface ChurchDataResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ChurchListResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  message?: string;
}

/**
 * Request DTOs
 */
export interface CreateChurchLeadershipRequest {
  full_name: string;
  role: string;
  title?: string;
  email?: string;
  phone?: string;
  appointed_date?: string;
  relieved_date?: string;
  start_date?: string;
  end_date?: string;
  biography?: string;
  photo_url?: string;
  is_primary?: number;
  display_order?: number;
  active?: number;
}

export interface UpdateChurchLeadershipRequest extends Partial<CreateChurchLeadershipRequest> {}

export interface CreateChurchStatisticRequest {
  year: number;
  month?: number;
  membership_count?: number;
  weekly_attendance?: number;
  baptisms?: number;
  confirmations?: number;
  marriages?: number;
  funerals?: number;
  tithes_offerings?: number;
  notes?: string;
}

export interface UpdateChurchStatisticRequest extends Partial<CreateChurchStatisticRequest> {}

export interface CreateChurchSocialMediaRequest {
  platform: string;
  url: string;
  username?: string;
  follower_count?: number;
  is_primary?: number;
  display_order?: number;
  active?: number;
}

export interface UpdateChurchSocialMediaRequest extends Partial<CreateChurchSocialMediaRequest> {}

export interface UpdateChurchProfileRequest {
  denomination_id?: number;
  archdiocese_id?: number;
  bishop_id?: number;
  founded_year?: number;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  about?: string;
  vision?: string;
  mission?: string;
  core_values?: string;
  service_times?: string;
  patron_name?: string;
}

/**
 * Pope Details Model
 * Represents global Pope information for display in General Information section.
 * Pope data is global (not tenant-specific).
 */
export interface PopeDetails {
  pope_name: string | null;
  pope_image_path: string | null;
  pope_image_url: string | null;
  pope_title: string | null;
  pope_effective_from: string | null;
}

export interface UpdatePopeDetailsRequest {
  pope_name: string;
  pope_title?: string;
  pope_effective_from?: string;
}

export * from './leadership-governance.model';

