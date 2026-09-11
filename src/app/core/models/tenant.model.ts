/**
 * Tenant Model
 * Defines all interfaces and types for tenant management
 * Updated for normalized database structure
 */

import { User, Address, USER_TYPE_PRIMARY_CONTACT, USER_TYPE_SECONDARY_CONTACT } from './user.model';

// Re-export for convenience
export { User, Address, USER_TYPE_PRIMARY_CONTACT, USER_TYPE_SECONDARY_CONTACT };

/**
 * Complete tenant entity from API (NORMALIZED STRUCTURE)
 */
export interface Tenant {
  id: number;
  name: string;
  slogan?: string | null;
  slug: string;
  domain?: string | null;
  
  // Subscription & limits
  plan: TenantPlan;
  max_users: number;
  max_storage_mb: number;
  trial_ends_at?: string | null;
  subscription_ends_at?: string | null;
  subscription_suspended_at?: string | null;
  /** Resolved lifecycle state from SubscriptionService::resolveStatus (list/detail). */
  subscription_status?: string | null;
  /** full | read_only — from SubscriptionService::accessMode (list/detail). */
  access_mode?: 'full' | 'read_only' | string | null;
  
  // Hierarchy
  tenant_tier?: TenantTier;
  parent_tenant_id?: number | null;

  // Status & settings
  active: 0 | 1;
  settings?: Record<string, any> | null;
  features?: string[] | null;
  
  // Branding
  logo_url?: string | null;
  logo_full_url?: string | null;
  primary_color: string;
  secondary_color: string;
  
  // Church Profile Fields (for Church Profile feature)
  denomination?: string | null;
  founded_year?: number | null;
  pastor_name?: string | null;
  associate_pastors?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  about?: string | null;
  vision?: string | null;
  mission?: string | null;
  core_values?: string | null;
  service_times?: string | null;
  weekly_attendance?: number | null;
  membership_count?: number | null;
  
  // Social Media Links
  social_facebook?: string | null;
  social_twitter?: string | null;
  social_instagram?: string | null;
  social_youtube?: string | null;
  
  // Audit fields
  created_by?: number | null;
  updated_by?: number | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  
  // Normalized Relations (NEW)
  // Backend returns snake_case, but we keep camelCase for consistency
  primaryContact?: User;
  primary_contact?: User; // API returns snake_case
  secondaryContact?: User | null;
  secondary_contact?: User | null; // API returns snake_case
  addresses?: Address[];
  users?: User[];
  creator?: User;
  updater?: User;
  
  // List aggregates (from withCount on list endpoint)
  users_count?: number;
  active_users_count?: number;

  // UI state properties (not from API)
  isTogglingStatus?: boolean;
}

/**
 * Tenant address structure (for API requests - backward compatible)
 */
/**
 * Tenant address structure for API requests
 * Updated to use geographic IDs for country and state, district remains string
 */
export interface TenantAddress {
  line1: string;
  line2?: string;
  country_id: number;       // Foreign key to countries table
  state_id: number;         // Foreign key to states table
  district: string;         // Text input (not a dropdown)
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
  subscription_status?: string;
}

/**
 * Create tenant request
 */
export interface CreateTenantRequest {
  tenant_name: string;
  slogan?: string;
  slug?: string;
  domain?: string;
  
  // Tenant official address (mandatory)
  tenant_official_address: TenantAddress;
  
  // Primary user (mandatory)
  primary_user_name: string;
  primary_user_email: string;
  primary_contact_number: string;
  primary_user_address: TenantAddress;
  
  // Secondary user (optional)
  secondary_user_name?: string;
  secondary_user_email?: string;
  secondary_contact_number?: string;
  secondary_user_address?: TenantAddress;
  
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
export type TenantTier = 'platform' | 'diocese' | 'parish' | 'branch';

export type TenantSubscriptionStatusFilter = 'trial' | 'subscribed' | 'grace' | 'suspended' | 'expired';

export interface TenantListParams {
  per_page?: number | 'all';
  page?: number;
  active?: 0 | 1;
  plan?: TenantPlan;
  tenant_tier?: TenantTier;
  archdiocese_id?: number;
  subscription_status?: TenantSubscriptionStatusFilter;
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
  /** Present when per_page=all */
  total?: number;
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

export interface TenantDetailsWarning {
  code: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

export interface TenantDetailsModule {
  key: string;
  label: string;
  entitled: boolean;
  gated: boolean;
  always_on: boolean;
  accessible: boolean;
  access_reason: string | null;
  subscription_status: string | null;
  access_mode: string;
}

export interface TenantDetailsUserPreview {
  id: number;
  name: string;
  email: string;
  profile_image_full_url?: string | null;
  role: string | null;
  status: 'active' | 'inactive' | string;
  is_primary_admin: boolean;
  last_seen_at: string | null;
  sign_ins_30d: number | null;
  created_at: string | null;
}

export interface TenantDetailsHistoryItem {
  id: string;
  category: string;
  action: string;
  action_label: string;
  summary: string;
  actor_name: string | null;
  actor_role: string | null;
  created_at: string | null;
}

export interface TenantDetailsSnapshot {
  identity: {
    id: number;
    name: string;
    slogan?: string | null;
    slug: string;
    domain?: string | null;
    tenant_tier?: TenantTier | string | null;
    parent_tenant_id?: number | null;
    parent_tenant_name?: string | null;
    hierarchy_path?: string | null;
    diocese_name?: string | null;
    diocese_id?: number | null;
    logo_url?: string | null;
    logo_full_url?: string | null;
    primary_color?: string;
    secondary_color?: string;
    created_at?: string | null;
    updated_at?: string | null;
    created_by?: { id: number; name: string } | null;
    updated_by?: { id: number; name: string } | null;
  };
  operational: {
    active: boolean;
    active_flag: 0 | 1;
  };
  subscription: Record<string, unknown> & {
    status?: string;
    access_mode?: 'full' | 'read_only' | string;
    plan_key?: string;
    plan_name?: string;
    is_read_only?: boolean;
    subscription_ends_at?: string | null;
    grace_ends_at?: string | null;
    days_until_end?: number | null;
    trial_ends_at?: string | null;
    subscription_suspended_at?: string | null;
    max_users?: number;
    max_storage_mb?: number;
    features?: string[];
  };
  modules: TenantDetailsModule[];
  contact: {
    primary_contact?: { id: number; name: string; email: string; phone?: string | null } | null;
    secondary_contact?: { id: number; name: string; email: string; phone?: string | null } | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    address?: {
      line1?: string;
      line2?: string | null;
      city?: string | null;
      district?: string;
      state_province?: string;
      country?: string;
      postal_code?: string;
    } | null;
  };
  administration: {
    primary_admin?: { id: number; name: string; email: string } | null;
    total_users: number;
    active_users: number;
    inactive_users: number;
    remaining_user_slots: number;
    max_users: number;
    role_distribution: Array<{ role: string; count: number }>;
  };
  church: {
    profile_configured?: boolean;
    denomination?: string | null;
    archdiocese?: { id: number; name: string; code?: string; country?: string } | null;
    bishop?: {
      id?: number;
      name?: string;
      title?: string;
      canonical_role?: string;
      photo_url?: string | null;
      effective_date?: string | null;
      is_current?: boolean;
    } | null;
    primary_pastor?: {
      id: number;
      name: string;
      role?: string;
      title?: string;
      email?: string;
      phone?: string;
      appointed_date?: string;
      photo_url?: string | null;
    } | null;
    founded_year?: number | null;
    patron_name?: string | null;
    about?: string | null;
    vision?: string | null;
    mission?: string | null;
    service_times?: string | null;
    country?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
  } | null;
  kpis: Record<string, number | string | null | undefined>;
  usage: {
    storage: {
      available: boolean;
      error?: string | null;
      used_bytes?: number | null;
      used_mb?: number | null;
      max_storage_mb?: number;
      remaining_mb?: number | null;
      percent_used?: number | null;
      file_count?: number | null;
    };
    users: {
      available: boolean;
      error?: string | null;
      total_users: number;
      active_users: number;
      inactive_users: number;
      seen_last_7d?: number | null;
      seen_last_30d?: number | null;
      frequent_users_30d?: number | null;
      never_signed_in?: number | null;
      last_seen_at?: string | null;
      role_distribution: Array<{ role: string; count: number }>;
      preview: TenantDetailsUserPreview[];
    };
  };
  users_preview: TenantDetailsUserPreview[];
  history_preview: TenantDetailsHistoryItem[];
  warnings: TenantDetailsWarning[];
  meta: {
    tenant_id: number;
    tenant_code: string;
    cache_version?: number;
    features?: string[];
    plan_key?: string;
    write_policy?: string;
    generated_at?: string;
  };
}

export interface TenantDetailsResponse {
  success: boolean;
  data: TenantDetailsSnapshot;
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

/**
 * Helper functions for accessing normalized tenant data
 */
export class TenantHelpers {
  /**
   * Get primary contact name from tenant
   */
  static getPrimaryContactName(tenant: Tenant): string {
    return tenant.primaryContact?.name || '';
  }

  /**
   * Get primary contact email from tenant
   */
  static getPrimaryContactEmail(tenant: Tenant): string {
    return tenant.primaryContact?.email || '';
  }

  /**
   * Get primary contact phone from tenant
   */
  static getPrimaryContactPhone(tenant: Tenant): string {
    return tenant.primaryContact?.contact_number || '';
  }

  /**
   * Get primary contact address from tenant
   */
  static getPrimaryContactAddress(tenant: Tenant): Address | null {
    if (tenant.primaryContact?.addresses && tenant.primaryContact.addresses.length > 0) {
      return tenant.primaryContact.addresses.find(addr => addr.address_type === 'primary' && addr.is_default) 
        || tenant.primaryContact.addresses[0];
    }
    return null;
  }

  /**
   * Get secondary contact name from tenant
   */
  static getSecondaryContactName(tenant: Tenant): string {
    return tenant.secondaryContact?.name || '';
  }

  /**
   * Get secondary contact email from tenant
   */
  static getSecondaryContactEmail(tenant: Tenant): string {
    return tenant.secondaryContact?.email || '';
  }

  /**
   * Get secondary contact phone from tenant
   */
  static getSecondaryContactPhone(tenant: Tenant): string {
    return tenant.secondaryContact?.contact_number || '';
  }

  /**
   * Get secondary contact address from tenant
   */
  static getSecondaryContactAddress(tenant: Tenant): Address | null {
    if (tenant.secondaryContact?.addresses && tenant.secondaryContact.addresses.length > 0) {
      return tenant.secondaryContact.addresses.find(addr => addr.address_type === 'primary' && addr.is_default)
        || tenant.secondaryContact.addresses[0];
    }
    return null;
  }

  /**
   * Format address for display
   */
  static formatAddress(address: Address | null): string {
    if (!address) return '';
    
    const parts: string[] = [];
    if (address.line1) parts.push(address.line1);
    if (address.line2) parts.push(address.line2);
    if (address.district) parts.push(address.district);
    if (address.state_province) parts.push(address.state_province);
    if (address.country) parts.push(address.country);
    if (address.pin_zip_code) parts.push(address.pin_zip_code);
    
    return parts.join(', ');
  }

  /**
   * Check if tenant has primary contact
   */
  static hasPrimaryContact(tenant: Tenant): boolean {
    return !!tenant.primaryContact;
  }

  /**
   * Check if tenant has secondary contact
   */
  static hasSecondaryContact(tenant: Tenant): boolean {
    return !!tenant.secondaryContact;
  }

  /**
   * Get user type label from integer value
   */
  static getUserTypeLabel(userType: number | null): string {
    switch (userType) {
      case USER_TYPE_PRIMARY_CONTACT:
        return 'Primary Contact';
      case USER_TYPE_SECONDARY_CONTACT:
        return 'Secondary Contact';
      default:
        return 'Unknown';
    }
  }

  /**
   * Check if user is primary contact
   */
  static isPrimaryContact(user: User): boolean {
    return user.user_type === USER_TYPE_PRIMARY_CONTACT;
  }

  /**
   * Check if user is secondary contact
   */
  static isSecondaryContact(user: User): boolean {
    return user.user_type === USER_TYPE_SECONDARY_CONTACT;
  }
}
