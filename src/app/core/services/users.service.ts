import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  User,
  UserListResponse,
  UserResponse,
  UserRequest,
  UserPermissionsResponse,
  LinkableClergy
} from '../models/user.model';

/**
 * UsersService - Tenant User Management Service
 * 
 * This service provides methods for managing users within a tenant,
 * including multi-role assignment and permission querying.
 * 
 * Features:
 * - Full CRUD operations for users
 * - Multi-role assignment
 * - Permission aggregation queries
 * - Tenant-isolated operations
 * - Search and filtering
 * 
 * @author Development Team
 * @date 2025-10-25
 */
@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private http = inject(HttpClient);
  /**
   * Backend route group for tenant user management lives under /api/users
   * (see Modules\Authentication\routes\api.php). The previous /tenant/users
   * prefix no longer exists, so point to /users to avoid 404s.
   */
  private apiUrl = `${environment.apiUrl}/users`;
  private tenantApiUrl = `${environment.apiUrl}/tenant/users`;

  /**
   * Get all users for the current tenant
   * 
   * @param params Query parameters (search, role_id, status, per_page)
   * @returns Observable of UserListResponse
   */
  getUsers(params?: {
    search?: string;
    role_id?: number;
    status?: 'active' | 'inactive';
    per_page?: number | 'all';
    page?: number;
  }): Observable<UserListResponse> {
    let httpParams = new HttpParams();

    if (params) {
      if (params.search) {
        httpParams = httpParams.set('search', params.search);
      }
      if (params.role_id) {
        httpParams = httpParams.set('role_id', params.role_id.toString());
      }
      if (params.status) {
        httpParams = httpParams.set('status', params.status);
      }
      if (params.per_page) {
        httpParams = httpParams.set('per_page', params.per_page.toString());
      }
      if (params.page) {
        httpParams = httpParams.set('page', params.page.toString());
      }
    }

    return this.http.get<UserListResponse>(this.apiUrl, { params: httpParams }).pipe(
      map(response => {
        // Ensure all users have a roles array
        if (response.data) {
          response.data = response.data.map(user => ({
            ...user,
            roles: user.roles || []
          }));
        }
        return response;
      }),
      catchError(error => {
        console.error('Error fetching users:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get a single user by ID
   * 
   * @param id User ID
   * @returns Observable of User with roles and permissions
   */
  getUser(id: number): Observable<User> {
    return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(
      map(response => {
        if (response.success && response.data) {
          // If response.data has user and all_permissions
          if (response.data.user) {
            return {
              ...response.data.user,
              roles: response.data.user.roles || [],
              permissions: response.data.all_permissions || []
            };
          }
          // Otherwise, assume response.data is the user
          return {
            ...response.data,
            roles: response.data.roles || [],
            permissions: response.data.permissions || []
          };
        }
        throw new Error('Invalid response format');
      }),
      catchError(error => {
        console.error('Error fetching user:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Create a new user
   * 
   * @param userData User creation data
   * @returns Observable of UserResponse
   */
  createUser(userData: UserRequest): Observable<UserResponse> {
    return this.http.post<UserResponse>(this.apiUrl, userData).pipe(
      map(response => {
        // Ensure user has roles array
        if (response.data && !response.data.roles) {
          response.data.roles = [];
        }
        return response;
      }),
      catchError(error => {
        console.error('Error creating user:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Update an existing user
   * 
   * @param id User ID
   * @param userData User update data
   * @returns Observable of UserResponse
   */
  updateUser(id: number, userData: Partial<UserRequest>): Observable<UserResponse> {
    return this.http.put<UserResponse>(`${this.apiUrl}/${id}`, userData).pipe(
      map(response => {
        // Ensure user has roles array
        if (response.data && !response.data.roles) {
          response.data.roles = [];
        }
        return response;
      }),
      catchError(error => {
        console.error('Error updating user:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Upload or replace a user's profile image.
   */
  uploadProfileImage(userId: number, file: File): Observable<UserResponse> {
    const formData = new FormData();
    formData.append('profile_image', file);

    return this.http.post<UserResponse>(`${this.apiUrl}/${userId}/profile-image`, formData).pipe(
      map(response => {
        if (response.data && !response.data.roles) {
          response.data.roles = [];
        }
        return response;
      }),
      catchError(error => {
        console.error('Error uploading user profile image:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Remove a user's profile image.
   */
  deleteProfileImage(userId: number): Observable<UserResponse> {
    return this.http.delete<UserResponse>(`${this.apiUrl}/${userId}/profile-image`).pipe(
      map(response => {
        if (response.data && !response.data.roles) {
          response.data.roles = [];
        }
        return response;
      }),
      catchError(error => {
        console.error('Error deleting user profile image:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Delete a user (soft delete)
   * 
   * @param id User ID
   * @returns Observable of success response
   */
  deleteUser(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/${id}`).pipe(
      catchError(error => {
        console.error('Error deleting user:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Assign roles to a user
   * 
   * @param userId User ID
   * @param roleIds Array of role IDs to assign
   * @returns Observable of UserResponse
   */
  assignRoles(userId: number, roleIds: number[], options?: { tenantMode?: boolean }): Observable<UserResponse> {
    return this.resolveAssignRolesRequest(userId, roleIds, options?.tenantMode).pipe(
      map(response => {
        // Ensure response.data has the updated user with roles
        if (response.data && response.success) {
          return response;
        }
        throw new Error('Invalid response format');
      }),
      catchError(error => {
        console.error('Error assigning roles:', error);
        return throwError(() => error);
      })
    );
  }

  getTenantUserRoles(userId: number): Observable<UserResponse> {
    return this.http.get<UserResponse>(`${this.tenantApiUrl}/${userId}/roles`).pipe(
      catchError(error => {
        console.error('Error fetching tenant user roles:', error);
        return throwError(() => error);
      })
    );
  }

  syncTenantUserRoles(userId: number, roleIds: number[]): Observable<UserResponse> {
    return this.http.put<UserResponse>(`${this.tenantApiUrl}/${userId}/roles`, { role_ids: roleIds }).pipe(
      catchError(error => {
        console.error('Error syncing tenant user roles:', error);
        return throwError(() => error);
      })
    );
  }

  private resolveAssignRolesRequest(userId: number, roleIds: number[], tenantMode = false): Observable<UserResponse> {
    if (tenantMode) {
      return this.http.put<UserResponse>(`${this.tenantApiUrl}/${userId}/roles`, { role_ids: roleIds });
    }

    return this.http.post<UserResponse>(`${this.apiUrl}/${userId}/roles`, { role_ids: roleIds });
  }

  /**
   * Get all permissions for a user (aggregated from all roles)
   * 
   * @param userId User ID
   * @returns Observable of UserPermissionsResponse
   */
  getUserPermissions(userId: number): Observable<UserPermissionsResponse> {
    return this.http.get<UserPermissionsResponse>(`${this.apiUrl}/${userId}/permissions`).pipe(
      catchError(error => {
        console.error('Error fetching user permissions:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Toggle user active status
   * 
   * @param userId User ID
   * @param active New active status (0 or 1)
   * @returns Observable of UserResponse
   */
  toggleUserStatus(userId: number, active: 0 | 1): Observable<UserResponse> {
    return this.http.put<UserResponse>(`${this.apiUrl}/${userId}`, { active }).pipe(
      catchError(error => {
        console.error('Error toggling user status:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Search users by query
   * 
   * @param query Search query string
   * @returns Observable of UserListResponse
   */
  searchUsers(query: string): Observable<UserListResponse> {
    return this.getUsers({ search: query, per_page: 'all' });
  }

  /**
   * Get users by role
   * 
   * @param roleId Role ID to filter by
   * @returns Observable of UserListResponse
   */
  getUsersByRole(roleId: number): Observable<UserListResponse> {
    return this.getUsers({ role_id: roleId, per_page: 'all' });
  }

  /**
   * Get active users only
   * 
   * @returns Observable of UserListResponse
   */
  getActiveUsers(): Observable<UserListResponse> {
    return this.getUsers({ status: 'active', per_page: 'all' });
  }

  /**
   * Get inactive users only
   * 
   * @returns Observable of UserListResponse
   */
  getInactiveUsers(): Observable<UserListResponse> {
    return this.getUsers({ status: 'inactive', per_page: 'all' });
  }

  /**
   * Get user statistics
   * 
   * @returns Observable with user statistics (total, active, inactive counts)
   */
  getStatistics(): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/users/statistics`).pipe(
      catchError(error => {
        console.error('Error fetching user statistics:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Update user status (active/inactive)
   * 
   * @param userId User ID
   * @param status New status (0 or 1)
   * @returns Observable of update response
   */
  updateStatus(userId: number, status: 0 | 1): Observable<any> {
    return this.http.patch<any>(`${environment.apiUrl}/users/${userId}/status`, { active: status }).pipe(
      catchError(error => {
        console.error('Error updating user status:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Search active parish clergy leaders available for login linking.
   */
  getLinkableClergy(search?: string): Observable<{ success: boolean; data: LinkableClergy[] }> {
    let params = new HttpParams();
    if (search && search.trim() !== '') {
      params = params.set('search', search.trim());
    }

    return this.http.get<{ success: boolean; data: LinkableClergy[] }>(
      `${this.apiUrl}/linkable-clergy`,
      { params }
    ).pipe(
      catchError(error => {
        console.error('Error fetching linkable clergy:', error);
        return throwError(() => error);
      })
    );
  }
}
