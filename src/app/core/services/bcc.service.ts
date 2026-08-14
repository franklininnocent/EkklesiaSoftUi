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
    if (filters.meeting_day) params = params.set('meeting_day', filters.meeting_day);
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
  updateLeader(bccId: string, leaderId: string, leader: Record<string, unknown>): Observable<ApiResponse<BCCLeader>> {
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

  getDashboard(params: Record<string, string | number | undefined | null> = {}): Observable<ApiResponse<unknown>> {
    const cleaned: Record<string, string | number> = {};
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '' || value === 'all') {
        return;
      }
      cleaned[key] = value;
    });
    return this.http.get<ApiResponse<unknown>>(`${this.apiUrl}/dashboard`, {
      params: this.toParams(cleaned),
    });
  }

  getOverview(bccId: string): Observable<ApiResponse<unknown>> {
    return this.http.get<ApiResponse<unknown>>(`${this.apiUrl}/${bccId}/dashboard`);
  }

  getMembers(bccId: string, params: Record<string, string | number | undefined> = {}): Observable<unknown> {
    return this.http.get(`${this.apiUrl}/${bccId}/members`, { params: this.toParams(params) });
  }

  assignMembers(
    bccId: string,
    familyIds: string[],
    options: { transfer?: boolean; joined_date?: string } = {}
  ): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.apiUrl}/${bccId}/members`, {
      family_ids: familyIds,
      transfer: options.transfer ?? false,
      joined_date: options.joined_date,
    });
  }

  removeMember(
    bccId: string,
    membershipId: string,
    body: { exit_date?: string; exit_reason?: string } = {}
  ): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.apiUrl}/${bccId}/members/${membershipId}`, {
      body,
    });
  }

  getPeople(bccId: string, params: Record<string, string | number | undefined> = {}): Observable<unknown> {
    return this.http.get(`${this.apiUrl}/${bccId}/people`, { params: this.toParams(params) });
  }

  lookupFamilies(params: Record<string, string | number | undefined> = {}): Observable<unknown> {
    return this.http.get(`${this.apiUrl}/families/lookup`, { params: this.toParams(params) });
  }

  getMemberHistory(bccId: string, params: Record<string, string | number | undefined> = {}): Observable<unknown> {
    return this.http.get(`${this.apiUrl}/${bccId}/member-history`, { params: this.toParams(params) });
  }

  getLeadershipCurrent(bccId: string): Observable<ApiResponse<unknown>> {
    return this.http.get<ApiResponse<unknown>>(`${this.apiUrl}/${bccId}/leadership/current`);
  }

  getLeadershipTimeline(
    bccId: string,
    params: Record<string, string | number | undefined> = {}
  ): Observable<unknown> {
    return this.http.get(`${this.apiUrl}/${bccId}/leadership/timeline`, { params: this.toParams(params) });
  }

  getEligibleLeaders(bccId: string): Observable<ApiResponse<unknown>> {
    return this.http.get<ApiResponse<unknown>>(`${this.apiUrl}/${bccId}/leadership/eligible`);
  }

  assignLeadership(bccId: string, payload: Record<string, unknown>): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.apiUrl}/${bccId}/leadership/assign`, payload);
  }

  terminateLeadership(
    bccId: string,
    leaderId: string,
    payload: Record<string, unknown> = {}
  ): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(
      `${this.apiUrl}/${bccId}/leadership/${leaderId}/terminate`,
      payload
    );
  }

  handoverLeadership(bccId: string, payload: Record<string, unknown>): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.apiUrl}/${bccId}/leadership/handover`, payload);
  }

  getAuditLogs(
    params: Record<string, string | number | undefined> = {},
    bccId?: string
  ): Observable<unknown> {
    const url = bccId ? `${this.apiUrl}/${bccId}/audit-logs` : `${this.apiUrl}/audit-logs`;
    return this.http.get(url, { params: this.toParams(params) });
  }

  private toParams(values: Record<string, string | number | undefined>): HttpParams {
    let params = new HttpParams();
    Object.entries(values).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return params;
  }
}


