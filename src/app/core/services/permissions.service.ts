import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
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
  private tenantApiUrl = `${environment.apiUrl}/tenant/permissions`;
  private tenantRoleApiUrl = `${environment.apiUrl}/tenant/roles`;

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
  }, options?: { tenantMode?: boolean }): Observable<PermissionListResponse> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        const value = params[key as keyof typeof params];
        if (value !== undefined && value !== null) {
          httpParams = httpParams.set(key, value.toString());
        }
      });
    }
    return this.http
      .get<PermissionListResponse>(this.resolvePermissionsApiUrl(options?.tenantMode), { params: httpParams })
      .pipe(map((response) => this.normalizePermissionCollectionResponse(response)));
  }

  /**
   * Get a specific permission by ID
   */
  getPermission(id: number, options?: { tenantMode?: boolean }): Observable<PermissionDetailResponse> {
    return this.http.get<PermissionDetailResponse>(`${this.resolvePermissionsApiUrl(options?.tenantMode)}/${id}`);
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
  bulkAssignToRole(assignment: BulkRolePermissionAssignment, options?: { tenantMode?: boolean }): Observable<ApiResponse> {
    if (options?.tenantMode) {
      return this.http.put<ApiResponse>(`${this.tenantRoleApiUrl}/${assignment.role_id}/permissions`, {
        permission_ids: assignment.permission_ids
      });
    }

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
  getPermissionsForRole(roleId: number, options?: { tenantMode?: boolean }): Observable<ApiResponse<Permission[]>> {
    if (options?.tenantMode) {
      return this.http.get<ApiResponse<Permission[]>>(`${this.tenantRoleApiUrl}/${roleId}/permissions`);
    }

    return this.http.get<ApiResponse<Permission[]>>(`${this.apiUrl}/role/${roleId}`);
  }

  /**
   * Explicit tenant-only catalog helper.
   */
  getTenantPermissions(params?: {
    per_page?: number | string;
    active?: 0 | 1;
    module?: string;
    category?: string;
    search?: string;
  }): Observable<PermissionListResponse> {
    return this.getPermissions(params, { tenantMode: true });
  }

  private resolvePermissionsApiUrl(tenantMode = false): string {
    return tenantMode ? this.tenantApiUrl : this.apiUrl;
  }

  /**
   * Normalizes tenant permission catalog responses.
   * Tenant endpoints may return grouped payloads:
   * [{ module: 'Users', permissions: Permission[] }]
   * but UI consumers expect a flat Permission[] under response.data.
   */
  private normalizePermissionCollectionResponse<T extends { data?: any }>(response: T): T {
    if (!response || !Array.isArray(response.data)) {
      return response;
    }

    return {
      ...response,
      data: this.flattenPermissionPayload(response.data)
    };
  }

  private flattenPermissionPayload(data: any[]): Permission[] {
    if (data.length === 0) {
      return [];
    }

    const isGroupedPayload = data.every((item) =>
      item && typeof item === 'object' && Array.isArray(item.permissions)
    );

    if (!isGroupedPayload) {
      return data as Permission[];
    }

    return data.flatMap((group) => {
      const moduleName = group.module ?? 'Uncategorized';
      return (group.permissions as Permission[]).map((permission) => ({
        ...permission,
        module: permission.module ?? moduleName
      }));
    });
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

