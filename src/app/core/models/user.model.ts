/**
 * User Type Constants (matching backend)
 */
export const USER_TYPE_PRIMARY_CONTACT = 1;    // Primary contact for tenant
export const USER_TYPE_SECONDARY_CONTACT = 2;  // Secondary contact for tenant

export interface User {
  id: number;
  name: string;
  email: string;
  contact_number?: string | null;
  user_type: 1 | 2 | null;  // 1 = primary_contact, 2 = secondary_contact
  tenant_id?: number | null;
  role_id?: number | null;
  active: 0 | 1;
  email_verified_at?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  
  // Relations
  addresses?: Address[];
  role?: UserRole;
  permissions?: string[];
  tenant?: any;
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

