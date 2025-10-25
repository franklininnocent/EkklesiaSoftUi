import { Permission } from './permission.model';

export interface Role {
  id: number;
  name: string;
  description?: string | null;
  level: number;
  tenant_id?: number | null;
  is_custom: boolean;
  active: 0 | 1;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  
  // Relationships
  tenant?: {
    id: number;
    name: string;
  } | null;
  permissions?: Permission[];
  
  // Computed/additional fields
  users_count?: number;
  permissions_count?: number;
}

export interface RoleCreateRequest {
  name: string;
  description?: string;
  level: number;
  tenant_id?: number | null;
  is_custom?: boolean;
}

export interface RoleUpdateRequest {
  name?: string;
  description?: string;
  level?: number;
  active?: boolean;
}

export interface RoleListResponse {
  success: boolean;
  current_page: number;
  data: Role[];
  first_page_url: string;
  from: number;
  last_page: number;
  last_page_url: string;
  next_page_url: string | null;
  path: string;
  per_page: number;
  prev_page_url: string | null;
  to: number;
  total: number;
}

export interface RoleDetailResponse {
  role: Role;
  stats: {
    total_users: number;
    active_users: number;
  };
}

