export interface User {
  id: number;
  name: string;
  email: string;
  email_verified_at?: string | null;
  created_at: string;
  updated_at: string;
  tenant_id?: number;
  role?: UserRole;
  permissions?: string[];
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

