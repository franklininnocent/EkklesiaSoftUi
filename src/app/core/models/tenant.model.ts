/**
 * Tenant Model
 * Defines all interfaces and types for tenant management
 */

/**
 * Complete tenant entity from API
 */
export interface Tenant {
  id: number;
  name: string;
  slug: string;
  domain?: string | null;
  
  // Primary user information
  primary_user_name: string;
  primary_user_email: string;
  primary_contact_number: string;
  
  // Secondary user information
  secondary_user_name?: string | null;
  secondary_user_email?: string | null;
  secondary_contact_number?: string | null;
  
  // Address information
  official_address: TenantAddress;
  official_address2?: TenantAddress | null;
  
  // Subscription & limits
  plan: TenantPlan;
  max_users: number;
  max_storage_mb: number;
  trial_ends_at?: string | null;
  subscription_ends_at?: string | null;
  
  // Status & settings
  active: 0 | 1;
  settings?: Record<string, any> | null;
  features?: string[] | null;
  
  // Branding
  logo_url?: string | null;
  logo_full_url?: string | null;
  primary_color: string;
  secondary_color: string;
  
  // Audit fields
  created_by?: number | null;
  updated_by?: number | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  
  // Relations (when included)
  creator?: any;
  updater?: any;
  users?: any[];
}

/**
 * Tenant address structure
 */
export interface TenantAddress {
  line1: string;
  line2?: string;
  district: string;
  state_province: string;
  country: string;
  pin_zip_code: string;
}

/**
 * Tenant subscription plans
 */
export type TenantPlan = 'free' | 'basic' | 'premium' | 'enterprise';

/**
 * Tenant status type
 */
export type TenantStatus = 'active' | 'inactive' | 'suspended';

/**
 * Tenant statistics from API
 */
export interface TenantStats {
  total_users: number;
  active_users: number;
  remaining_slots: number;
  has_active_subscription: boolean;
  is_in_trial: boolean;
}

/**
 * Create tenant request
 */
export interface CreateTenantRequest {
  tenant_name: string;
  slug?: string;
  domain?: string;
  
  // Primary user (mandatory)
  primary_user_name: string;
  primary_user_email: string;
  primary_contact_number: string;
  
  // Secondary user (optional)
  secondary_user_name?: string;
  secondary_user_email?: string;
  secondary_contact_number?: string;
  
  // Addresses
  official_address: TenantAddress;
  official_address2?: TenantAddress;
  
  // Logo (File will be added separately via FormData)
  tenant_logo?: File;
  
  // Branding
  primary_color?: string;
  secondary_color?: string;
  
  // Subscription
  plan?: TenantPlan;
  max_users?: number;
  max_storage_mb?: number;
  trial_ends_at?: string;
  subscription_ends_at?: string;
  
  // Settings
  settings?: Record<string, any>;
  features?: string[];
}

/**
 * Update tenant request (all fields optional)
 */
export interface UpdateTenantRequest extends Partial<CreateTenantRequest> {}

/**
 * Tenant list query parameters
 */
export interface TenantListParams {
  per_page?: number | 'all';
  page?: number;
  active?: 0 | 1;
  plan?: TenantPlan;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

/**
 * Tenant list response with pagination
 */
export interface TenantListResponse {
  success: boolean;
  data: Tenant[];
  pagination?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
  };
  message?: string;
}

/**
 * Single tenant response
 */
export interface TenantResponse {
  success: boolean;
  data: Tenant;
  stats?: TenantStats;
  message?: string;
}

/**
 * Tenant statistics response
 */
export interface TenantStatisticsResponse {
  success: boolean;
  data: {
    total_tenants: number;
    active_tenants: number;
    inactive_tenants: number;
    tenants_by_plan: {
      free: number;
      basic: number;
      premium: number;
      enterprise: number;
    };
    in_trial: number;
    subscribed: number;
    recent_tenants: Tenant[];
  };
  message?: string;
}

/**
 * Logo upload response
 */
export interface LogoUploadResponse {
  success: boolean;
  data: {
    logo_url: string;
    logo_full_url: string;
  };
  message?: string;
}

/**
 * Generic success response
 */
export interface TenantSuccessResponse {
  success: boolean;
  message: string;
  data?: any;
}

/**
 * Tenant error response
 */
export interface TenantErrorResponse {
  success: false;
  message: string;
  error?: string;
  errors?: Record<string, string[]>;
}

/**
 * Tenant state for component management
 */
export interface TenantState {
  tenants: Tenant[];
  currentTenant: Tenant | null;
  statistics: TenantStatisticsResponse['data'] | null;
  loading: boolean;
  error: string | null;
  pagination: TenantListResponse['pagination'] | null;
}
