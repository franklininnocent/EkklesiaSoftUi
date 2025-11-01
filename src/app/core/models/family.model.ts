export interface Family {
  id: string;
  tenant_id: string;
  family_code: string;
  family_name: string;
  head_of_family?: string;
  head_avatar_url?: string;
  head_profile_image_url?: string;  // Family head profile image (database path)
  head_profile_image_full_url?: string;  // Family head profile image (full URL)
  profile_image_url?: string;  // Family profile image (database path)
  profile_image_full_url?: string;  // Family profile image (full URL)
  
  // Address Information
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state_id?: string;
  country_id?: string;
  postal_code?: string;
  
  // Relations
  bcc_id?: string;
  
  // Contact Information
  primary_phone?: string;
  secondary_phone?: string;
  email?: string;
  
  // Status
  status: 'active' | 'inactive' | 'migrated';
  notes?: string;
  
  // Timestamps
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
  
  // Relationships (loaded when needed)
  bcc?: BCC;
  country?: Country;
  state?: State;
  members?: FamilyMember[];
  creator?: User;
  updater?: User;
  
  // Computed
  member_count?: number;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  
  // Personal Information
  first_name: string;
  middle_name?: string;
  last_name: string;
  full_name?: string;
  
  // Demographics
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other';
  relationship_to_head: 'self' | 'spouse' | 'son' | 'daughter' | 'father' | 'mother' | 
                         'brother' | 'sister' | 'grandfather' | 'grandmother' | 
                         'grandson' | 'granddaughter' | 'uncle' | 'aunt' | 
                         'nephew' | 'niece' | 'cousin' | 'other';
  marital_status?: 'single' | 'married' | 'widowed' | 'separated' | 'divorced';
  
  // Contact Information
  phone?: string;
  email?: string;
  is_primary_contact?: boolean;
  
  // Sacrament Information
  baptism_date?: string;
  baptism_place?: string;
  first_communion_date?: string;
  first_communion_place?: string;
  confirmation_date?: string;
  confirmation_place?: string;
  marriage_date?: string;
  marriage_place?: string;
  marriage_spouse_name?: string;
  
  // Additional Information
  occupation?: string;
  education?: string;
  skills_talents?: string;
  notes?: string;
  
  // Status
  status: 'active' | 'inactive' | 'deceased' | 'migrated';
  deceased_date?: string;
  
  // Timestamps
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
  
  // Relationships
  family?: Family;
  creator?: User;
  updater?: User;
}

export interface ParishZone {
  // Removed: Parish Zone entity no longer used in UI
}

export interface BCC {
  id: string;
  tenant_id: string;
  bcc_code: string;
  name: string;
  description?: string;
  
  // Location
  meeting_place?: string;
  
  // Meeting Schedule
  meeting_day?: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  meeting_time?: string;
  meeting_frequency?: string;
  
  // Status and Dates
  status: 'active' | 'inactive' | 'suspended';
  established_date?: string;
  notes?: string;
  
  // Timestamps
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
  
  // Relationships
  families?: Family[];
  leaders?: BCCLeader[];
  creator?: User;
  updater?: User;
  
  // Computed
  current_family_count?: number;
  families_count?: number;
  is_at_capacity?: boolean;
  capacity_percentage?: number;
}

export interface BCCLeader {
  id: string;
  bcc_id: string;
  user_id?: string;
  family_member_id?: string;
  leader_name: string;
  role: string;
  assigned_date?: string;
  end_date?: string;
  is_current: boolean;
  responsibilities?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
  
  // Relationships
  bcc?: BCC;
  user?: User;
  family_member?: FamilyMember;
  creator?: User;
  updater?: User;
}

export interface Country {
  id: string;
  name: string;
  code: string;
  phone_code?: string;
}

export interface State {
  id: string;
  country_id: string;
  name: string;
  code?: string;
  country?: Country;
}

export interface User {
  id: string;
  name: string;
  email: string;
  tenant_id?: string;
  user_type?: number;
}

// API Response interfaces
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  current_page: number;
  last_page: number;
  per_page: number;
  from: number;
  to: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface FamilyStatistics {
  total_families: number;
  active_families: number;
  inactive_families: number;
  total_members: number;
  active_members: number;
  families_with_bcc: number;
  families_without_bcc: number;
  families_by_zone: {
    parish_zone_id: string;
    count: number;
    parish_zone: ParishZone;
  }[];
}

export interface BCCStatistics {
  total_bccs: number;
  active_bccs: number;
  inactive_bccs: number;
  bccs_with_space: number;
  total_families_in_bcc: number;
  total_families_in_bccs: number;
  total_leaders: number;
  total_capacity: number;
  current_utilization: number;
  utilization_percentage: number;
  bccs_by_zone: {
    parish_zone_id: string;
    count: number;
    parish_zone: ParishZone;
  }[];
}

// Filter interfaces
export interface FamilyFilters {
  search?: string;
  status?: string;
  bcc_id?: string;
  parish_zone_id?: string;
  city?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface BCCFilters {
  search?: string;
  status?: string;
  parish_zone_id?: string;
  has_space?: boolean;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}


