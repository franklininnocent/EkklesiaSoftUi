import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { User } from '@core/models';

export interface UsersListResponse {
  success: boolean;
  data: User[];
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

export interface UserStatsResponse {
  success: boolean;
  data: {
    total: number;
    active: number;
    inactive: number;
    by_role: any[];
  };
}

export interface UserStatusUpdateResponse {
  success: boolean;
  message: string;
  data?: User;
}

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private apiUrl = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}

  /**
   * Get list of users (tenant-filtered automatically by backend)
   */
  getUsers(params?: {
    page?: number;
    per_page?: number | 'all';
    search?: string;
    active?: 0 | 1;
    role_id?: number;
    tenant_id?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }): Observable<UsersListResponse> {
    let httpParams = new HttpParams();

    if (params) {
      Object.keys(params).forEach(key => {
        const value = params[key as keyof typeof params];
        if (value !== undefined && value !== null) {
          httpParams = httpParams.set(key, value.toString());
        }
      });
    }

    return this.http.get<UsersListResponse>(this.apiUrl, { params: httpParams });
  }

  /**
   * Get a specific user by ID
   */
  getUser(id: number): Observable<{ success: boolean; data: User; message?: string }> {
    return this.http.get<{ success: boolean; data: User; message?: string }>(`${this.apiUrl}/${id}`);
  }

  /**
   * Get user statistics (tenant-filtered)
   */
  getStatistics(): Observable<UserStatsResponse> {
    return this.http.get<UserStatsResponse>(`${this.apiUrl}/statistics`);
  }

  /**
   * Update user status (active/inactive)
   */
  updateStatus(userId: number, active: 0 | 1): Observable<UserStatusUpdateResponse> {
    return this.http.patch<UserStatusUpdateResponse>(
      `${this.apiUrl}/${userId}/status`,
      { active }
    );
  }
}

