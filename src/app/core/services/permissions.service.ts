import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import {
  Permission,
  PermissionCreateRequest,
  PermissionUpdateRequest,
  PermissionListResponse,
  PermissionDetailResponse,
  RolePermissionAssignment,
  BulkRolePermissionAssignment
} from '@core/models';

interface ApiResponse<T = any> {
  success?: boolean;
  message?: string;
  data?: T;
}

@Injectable({
  providedIn: 'root'
})
export class PermissionsService {
  private apiUrl = `${environment.apiUrl}/permissions`;

  constructor(private http: HttpClient) {}

  /**
   * Get list of permissions with optional filters
   */
  getPermissions(params?: {
    per_page?: number | string;
    active?: 0 | 1;
    tenant_id?: number;
    module?: string;
    category?: string;
    is_custom?: boolean;
    search?: string;
  }): Observable<PermissionListResponse> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        const value = params[key as keyof typeof params];
        if (value !== undefined && value !== null) {
          httpParams = httpParams.set(key, value.toString());
        }
      });
    }
    return this.http.get<PermissionListResponse>(this.apiUrl, { params: httpParams });
  }

  /**
   * Get a specific permission by ID
   */
  getPermission(id: number): Observable<PermissionDetailResponse> {
    return this.http.get<PermissionDetailResponse>(`${this.apiUrl}/${id}`);
  }

  /**
   * Create a new permission
   */
  createPermission(permission: PermissionCreateRequest): Observable<ApiResponse<{ permission: Permission }>> {
    return this.http.post<ApiResponse<{ permission: Permission }>>(this.apiUrl, permission);
  }

  /**
   * Update an existing permission
   */
  updatePermission(id: number, permission: PermissionUpdateRequest): Observable<ApiResponse<{ permission: Permission }>> {
    return this.http.put<ApiResponse<{ permission: Permission }>>(`${this.apiUrl}/${id}`, permission);
  }

  /**
   * Delete a permission (soft delete)
   */
  deletePermission(id: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.apiUrl}/${id}`);
  }

  /**
   * Assign a permission to a role
   */
  assignToRole(assignment: RolePermissionAssignment): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/assign-to-role`, assignment);
  }

  /**
   * Remove a permission from a role
   */
  removeFromRole(assignment: RolePermissionAssignment): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/remove-from-role`, assignment);
  }

  /**
   * Bulk assign permissions to a role
   */
  bulkAssignToRole(assignment: BulkRolePermissionAssignment): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/bulk-assign-to-role`, assignment);
  }

  /**
   * Assign a permission directly to a user
   */
  assignToUser(permissionId: number, userId: number): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/assign-to-user`, {
      permission_id: permissionId,
      user_id: userId
    });
  }

  /**
   * Remove a permission from a user
   */
  removeFromUser(permissionId: number, userId: number): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/remove-from-user`, {
      permission_id: permissionId,
      user_id: userId
    });
  }

  /**
   * Get permissions for a specific role
   */
  getPermissionsForRole(roleId: number): Observable<ApiResponse<Permission[]>> {
    return this.http.get<ApiResponse<Permission[]>>(`${this.apiUrl}/role/${roleId}`);
  }

  /**
   * Get available modules (unique modules from permissions)
   */
  getAvailableModules(): Observable<ApiResponse<string[]>> {
    return this.http.get<ApiResponse<string[]>>(`${this.apiUrl}/modules`);
  }

  /**
   * Get available categories (unique categories from permissions)
   */
  getAvailableCategories(module?: string): Observable<ApiResponse<string[]>> {
    let params = new HttpParams();
    if (module) {
      params = params.set('module', module);
    }
    return this.http.get<ApiResponse<string[]>>(`${this.apiUrl}/categories`, { params });
  }
}

