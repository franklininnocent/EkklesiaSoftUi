import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import {
  Role,
  RoleCreateRequest,
  RoleUpdateRequest,
  RoleListResponse,
  RoleDetailResponse
} from '@core/models';

interface ApiResponse<T = any> {
  success?: boolean;
  message?: string;
  data?: T;
}

@Injectable({
  providedIn: 'root'
})
export class RolesService {
  private apiUrl = `${environment.apiUrl}/roles`;

  constructor(private http: HttpClient) {}

  /**
   * Get list of roles with optional filters
   */
  getRoles(params?: {
    per_page?: number | string;
    active?: 0 | 1;
    tenant_id?: number;
    is_custom?: boolean;
    search?: string;
  }): Observable<RoleListResponse> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        const value = params[key as keyof typeof params];
        if (value !== undefined && value !== null) {
          httpParams = httpParams.set(key, value.toString());
        }
      });
    }
    return this.http.get<RoleListResponse>(this.apiUrl, { params: httpParams });
  }

  /**
   * Get a specific role by ID
   */
  getRole(id: number): Observable<RoleDetailResponse> {
    return this.http.get<RoleDetailResponse>(`${this.apiUrl}/${id}`);
  }

  /**
   * Create a new role
   */
  createRole(role: RoleCreateRequest): Observable<ApiResponse<{ role: Role }>> {
    return this.http.post<ApiResponse<{ role: Role }>>(this.apiUrl, role);
  }

  /**
   * Update an existing role
   */
  updateRole(id: number, role: RoleUpdateRequest): Observable<ApiResponse<{ role: Role }>> {
    return this.http.put<ApiResponse<{ role: Role }>>(`${this.apiUrl}/${id}`, role);
  }

  /**
   * Delete a role (soft delete)
   */
  deleteRole(id: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.apiUrl}/${id}`);
  }

  /**
   * Restore a soft-deleted role
   */
  restoreRole(id: number): Observable<ApiResponse<{ role: Role }>> {
    return this.http.post<ApiResponse<{ role: Role }>>(`${this.apiUrl}/${id}/restore`, {});
  }

  /**
   * Activate a role
   */
  activateRole(id: number): Observable<ApiResponse<{ role: Role }>> {
    return this.http.post<ApiResponse<{ role: Role }>>(`${this.apiUrl}/${id}/activate`, {});
  }

  /**
   * Deactivate a role
   */
  deactivateRole(id: number): Observable<ApiResponse<{ role: Role }>> {
    return this.http.post<ApiResponse<{ role: Role }>>(`${this.apiUrl}/${id}/deactivate`, {});
  }

  /**
   * Toggle role active status
   */
  toggleRoleStatus(id: number, active: boolean): Observable<ApiResponse<{ role: Role }>> {
    return active ? this.activateRole(id) : this.deactivateRole(id);
  }
}

