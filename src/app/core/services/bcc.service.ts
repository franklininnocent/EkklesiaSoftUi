import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  BCC,
  BCCLeader,
  BCCFilters,
  BCCStatistics,
  PaginatedResponse,
  ApiResponse
} from '../models/family.model';

@Injectable({
  providedIn: 'root'
})
export class BCCService {
  private apiUrl = `${environment.apiUrl}/bccs`;

  constructor(private http: HttpClient) {}

  /**
   * Get paginated list of BCCs
   */
  getBCCs(filters: BCCFilters = {}): Observable<PaginatedResponse<BCC>> {
    let params = new HttpParams();
    
    if (filters.search) params = params.set('search', filters.search);
    if (filters.status) params = params.set('status', filters.status);
    if (filters.has_space !== undefined) params = params.set('has_space', filters.has_space.toString());
    if (filters.sort_by) params = params.set('sort_by', filters.sort_by);
    if (filters.sort_order) params = params.set('sort_order', filters.sort_order);
    if (filters.per_page) params = params.set('per_page', filters.per_page.toString());
    if (filters.page) params = params.set('page', filters.page.toString());

    return this.http.get<PaginatedResponse<BCC>>(this.apiUrl, { params });
  }

  /**
   * Get a single BCC by ID
   */
  getBCC(id: string): Observable<ApiResponse<BCC>> {
    return this.http.get<ApiResponse<BCC>>(`${this.apiUrl}/${id}`);
  }

  /**
   * Create a new BCC
   */
  createBCC(bcc: Partial<BCC>): Observable<ApiResponse<BCC>> {
    return this.http.post<ApiResponse<BCC>>(this.apiUrl, bcc);
  }

  /**
   * Update a BCC
   */
  updateBCC(id: string, bcc: Partial<BCC>): Observable<ApiResponse<BCC>> {
    return this.http.put<ApiResponse<BCC>>(`${this.apiUrl}/${id}`, bcc);
  }

  /**
   * Delete a BCC
   */
  deleteBCC(id: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}`);
  }

  /**
   * Get BCC statistics
   */
  getStatistics(): Observable<ApiResponse<BCCStatistics>> {
    return this.http.get<ApiResponse<BCCStatistics>>(`${this.apiUrl}/statistics`);
  }

  /**
   * Get BCCs with available space
   */
  getBCCsWithSpace(): Observable<ApiResponse<BCC[]>> {
    return this.http.get<ApiResponse<BCC[]>>(`${this.apiUrl}/with-space`);
  }

  // ==================== LEADER OPERATIONS ====================

  /**
   * Get all leaders for a BCC
   */
  getLeaders(bccId: string): Observable<ApiResponse<BCCLeader[]>> {
    return this.http.get<ApiResponse<BCCLeader[]>>(`${this.apiUrl}/${bccId}/leaders`);
  }

  /**
   * Add a leader to a BCC
   */
  addLeader(bccId: string, leader: Partial<BCCLeader>): Observable<ApiResponse<BCCLeader>> {
    return this.http.post<ApiResponse<BCCLeader>>(`${this.apiUrl}/${bccId}/leaders`, leader);
  }

  /**
   * Update a BCC leader
   */
  updateLeader(bccId: string, leaderId: string, leader: Partial<BCCLeader>): Observable<ApiResponse<BCCLeader>> {
    return this.http.put<ApiResponse<BCCLeader>>(`${this.apiUrl}/${bccId}/leaders/${leaderId}`, leader);
  }

  /**
   * Delete a BCC leader
   */
  deleteLeader(bccId: string, leaderId: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${bccId}/leaders/${leaderId}`);
  }

  // ==================== FAMILY ASSIGNMENT ====================

  /**
   * Assign families to a BCC
   */
  assignFamilies(bccId: string, familyIds: string[]): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/${bccId}/assign-families`, {
      family_ids: familyIds
    });
  }

  /**
   * Remove families from BCC
   */
  removeFamilies(familyIds: string[]): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/remove-families`, {
      family_ids: familyIds
    });
  }
}


