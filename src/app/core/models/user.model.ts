import { Permission } from './permission.model';
import { Role } from './role.model';

/**
 * User Type Constants (matching backend)
 */
export const USER_TYPE_PRIMARY_CONTACT = 1;    // Primary contact for tenant
export const USER_TYPE_SECONDARY_CONTACT = 2;  // Secondary contact for tenant

/**
 * User Interface (Multi-Role Support)
 */
export interface User {
  id: number;
  name: string;
  email: string;
  contact_number?: string | null;
  user_type: 1 | 2 | null;  // 1 = primary_contact, 2 = secondary_contact
  is_primary_admin?: boolean;  // Primary admin created during tenant onboarding - cannot be deleted/deactivated by tenant users
  tenant_id?: number | null;
  
  // Legacy single role support (deprecated)
  role_id?: number | null;
  role_name?: string | null;
  role_level?: number | null;
  
  active: 0 | 1;
  email_verified_at?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  
  // Authorization flags (from backend)
  can_edit?: boolean;  // Whether the current user can edit this user
  is_self?: boolean;   // Whether this is the current user's own account
  edit_restriction_reason?: string | null;  // Reason why user cannot edit (if can_edit is false)
  is_super_admin?: boolean;  // User has SuperAdmin role
  is_admin?: boolean;  // User has SuperAdmin or EkklesiaAdmin role
  has_ekklesia_role?: boolean;  // User has any Ekklesia role (SuperAdmin, EkklesiaAdmin, EkklesiaManager, EkklesiaUser)
  
  // Relations
  addresses?: Address[];
  role?: Role; // Legacy single role object (deprecated)
  roles?: Role[]; // Multiple roles support
  permissions?: Permission[]; // Aggregated permissions from all roles
  tenant?: any;
}

/**
 * User List Response from API
 */
export interface UserListResponse {
  success: boolean;
  data: User[];
  message?: string;
  pagination?: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
  meta?: {
    total: number;
  };
}

/**
 * Single User Response from API
 */
export interface UserResponse {
  success: boolean;
  data: User;
  message?: string;
}

/**
 * User Create/Update Request
 */
export interface UserRequest {
  name: string;
  email: string;
  password?: string;
  password_confirmation?: string;
  contact_number?: string;
  user_type?: 1 | 2;
  role_ids: number[]; // Array of role IDs for multi-role support
  active?: 0 | 1;
}

/**
 * User Permissions Response
 */
export interface UserPermissionsResponse {
  success: boolean;
  data: {
    user_id: number;
    user_name: string;
    roles: Role[];
    permissions: Permission[];
    total_permissions: number;
  };
}

export interface Address {
  id: number;
  addressable_id: number;
  addressable_type: string;
  address_type: 'primary' | 'secondary' | 'billing' | 'shipping' | 'official';
  label?: string | null;
  line1: string;
  line2?: string | null;
  district: string;
  city?: string | null;
  state_province: string;
  country: string;
  pin_zip_code: string;
  latitude?: number | null;
  longitude?: number | null;
  is_default: boolean;
  active: 0 | 1;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  country_id?: number;
  state_id?: number;
  full_address?: string;
  short_address?: string;
}

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  TENANT_ADMIN = 'tenant_admin',
  MANAGER = 'manager',
  USER = 'user'
}

export interface UserPermission {
  id: number;
  name: string;
  description?: string;
}

