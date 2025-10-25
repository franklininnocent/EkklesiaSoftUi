export interface Permission {
  id: number;
  name: string;
  display_name: string;
  description?: string | null;
  module?: string | null;
  category?: string | null;
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
  
  // Computed/additional fields
  roles_count?: number;
  users_count?: number;
}

export interface PermissionCreateRequest {
  name: string;
  display_name: string;
  description?: string;
  module?: string;
  category?: string;
  tenant_id?: number | null;
  is_custom?: boolean;
}

export interface PermissionUpdateRequest {
  name?: string;
  display_name?: string;
  description?: string;
  module?: string;
  category?: string;
  active?: boolean;
}

export interface PermissionListResponse {
  current_page: number;
  data: Permission[];
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

export interface PermissionDetailResponse {
  permission: Permission;
  stats: {
    assigned_to_roles: number;
    assigned_to_users: number;
  };
}

export interface RolePermissionAssignment {
  role_id: number;
  permission_id: number;
}

export interface BulkRolePermissionAssignment {
  role_id: number;
  permission_ids: number[];
}

