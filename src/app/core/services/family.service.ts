import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Family,
  FamilyMember,
  FamilyFilters,
  FamilyStatistics,
  PaginatedResponse,
  ApiResponse,
  BccRelocationPreview,
  RelocateBccPayload,
  MarriageTransitionPayload,
  FamilyTransitionHistoryRecord
} from '../models/family.model';
import { FamilyDashboardSummary } from '@features/family-management/models/family-dashboard.model';

@Injectable({
  providedIn: 'root'
})
export class FamilyService {
  private apiUrl = `${environment.apiUrl}/families`;

  constructor(private http: HttpClient) {}

  /** Build headers carrying tenant country for server-side phone validation */
  private buildTenantCountryHeaders(): { headers: HttpHeaders } | {} {
    try {
      const iso2 = localStorage.getItem('tenant_country_code');
      if (iso2 && iso2.length >= 2) {
        return { headers: new HttpHeaders({ 'X-Tenant-Country': iso2.toUpperCase() }) };
      }
    } catch {}
    return {};
  }

  /**
   * Get paginated list of families
   */
  getFamilies(filters: FamilyFilters = {}): Observable<PaginatedResponse<Family>> {
    let params = new HttpParams();
    
    if (filters.search) params = params.set('search', filters.search);
    if (filters.status) params = params.set('status', filters.status);
    if (filters.bcc_id) params = params.set('bcc_id', filters.bcc_id);
    if (filters.missing_sacrament) params = params.set('missing_sacrament', filters.missing_sacrament);
    if (filters.progression) params = params.set('progression', filters.progression);
    if (filters.city) params = params.set('city', filters.city);
    if (filters.city_exact) params = params.set('city_exact', filters.city_exact);
    if (filters.missing) params = params.set('missing', filters.missing);
    if (filters.size_band) params = params.set('size_band', filters.size_band);
    if (filters.household) params = params.set('household', filters.household);
    if (filters.created_from) params = params.set('created_from', filters.created_from);
    if (filters.created_to) params = params.set('created_to', filters.created_to);
    if (filters.sort_by) params = params.set('sort_by', filters.sort_by);
    if (filters.sort_order) params = params.set('sort_order', filters.sort_order);
    if (filters.per_page) params = params.set('per_page', filters.per_page.toString());
    if (filters.page) params = params.set('page', filters.page.toString());

    return this.http.get<PaginatedResponse<Family>>(this.apiUrl, { params, ...this.buildTenantCountryHeaders() });
  }

  /**
   * Get a single family by ID
   */
  getFamily(id: string): Observable<ApiResponse<Family>> {
    return this.http.get<ApiResponse<Family>>(`${this.apiUrl}/${id}`, this.buildTenantCountryHeaders());
  }

  /**
   * Create a new family
   */
  createFamily(family: Partial<Family>): Observable<ApiResponse<Family>> {
    return this.http.post<ApiResponse<Family>>(this.apiUrl, family, this.buildTenantCountryHeaders());
  }

  /**
   * Update a family
   */
  updateFamily(id: string, family: Partial<Family>): Observable<ApiResponse<Family>> {
    return this.http.put<ApiResponse<Family>>(`${this.apiUrl}/${id}`, family, this.buildTenantCountryHeaders());
  }

  /**
   * Delete a family
   */
  deleteFamily(id: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}`, this.buildTenantCountryHeaders());
  }

  /**
   * Get family statistics
   */
  getStatistics(): Observable<ApiResponse<FamilyStatistics>> {
    return this.http.get<ApiResponse<FamilyStatistics>>(`${this.apiUrl}/statistics`, this.buildTenantCountryHeaders());
  }

  getDashboard(params: {
    bcc_id?: string;
    status?: string;
    period?: string;
    from?: string;
    to?: string;
    refresh?: boolean;
  } = {}): Observable<ApiResponse<FamilyDashboardSummary>> {
    let httpParams = new HttpParams();
    if (params.bcc_id) httpParams = httpParams.set('bcc_id', params.bcc_id);
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.period) httpParams = httpParams.set('period', params.period);
    if (params.from) httpParams = httpParams.set('from', params.from);
    if (params.to) httpParams = httpParams.set('to', params.to);
    if (params.refresh) httpParams = httpParams.set('refresh', '1');

    return this.http.get<ApiResponse<FamilyDashboardSummary>>(`${this.apiUrl}/dashboard`, {
      params: httpParams,
      ...this.buildTenantCountryHeaders(),
    });
  }

  /**
   * Get families without BCC assignment
   */
  getFamiliesWithoutBCC(): Observable<ApiResponse<Family[]>> {
    return this.http.get<ApiResponse<Family[]>>(`${this.apiUrl}/without-bcc`, this.buildTenantCountryHeaders());
  }

  /**
   * Get families by BCC
   */
  getFamiliesByBCC(bccId: string): Observable<ApiResponse<Family[]>> {
    return this.http.get<ApiResponse<Family[]>>(`${this.apiUrl}/bcc/${bccId}`, this.buildTenantCountryHeaders());
  }

  // ==================== FAMILY MEMBER OPERATIONS ====================

  /**
   * Get all members of a family
   */
  getFamilyMembers(familyId: string): Observable<ApiResponse<FamilyMember[]>> {
    return this.http.get<ApiResponse<FamilyMember[]>>(`${this.apiUrl}/${familyId}/members`, this.buildTenantCountryHeaders());
  }

  /**
   * Add a member to a family
   */
  addFamilyMember(familyId: string, member: Partial<FamilyMember>): Observable<ApiResponse<FamilyMember>> {
    return this.http.post<ApiResponse<FamilyMember>>(`${this.apiUrl}/${familyId}/members`, member, this.buildTenantCountryHeaders());
  }

  /**
   * Update a family member
   */
  updateFamilyMember(familyId: string, memberId: string, member: Partial<FamilyMember>): Observable<ApiResponse<FamilyMember>> {
    return this.http.put<ApiResponse<FamilyMember>>(`${this.apiUrl}/${familyId}/members/${memberId}`, member, this.buildTenantCountryHeaders());
  }

  /**
   * Delete a family member
   */
  deleteFamilyMember(familyId: string, memberId: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${familyId}/members/${memberId}`, this.buildTenantCountryHeaders());
  }

  // ==================== FAMILY PROFILE IMAGE OPERATIONS ====================

  /**
   * Upload or update family profile image
   */
  uploadProfileImage(familyId: string, file: File): Observable<ApiResponse<Family>> {
    const formData = new FormData();
    formData.append('profile_image', file);

    return this.http.post<ApiResponse<Family>>(`${this.apiUrl}/${familyId}/profile-image`, formData);
  }

  /**
   * Delete family profile image
   */
  deleteProfileImage(familyId: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${familyId}/profile-image`);
  }

  // ==================== FAMILY HEAD PROFILE IMAGE OPERATIONS ====================

  /**
   * Upload or update family head profile image
   */
  uploadHeadProfileImage(familyId: string, file: File): Observable<ApiResponse<Family>> {
    const formData = new FormData();
    formData.append('head_profile_image', file);

    return this.http.post<ApiResponse<Family>>(`${this.apiUrl}/${familyId}/head-profile-image`, formData);
  }

  /**
   * Delete family head profile image
   */
  deleteHeadProfileImage(familyId: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${familyId}/head-profile-image`);
  }

  // ==================== HOUSEHOLD TRANSITIONS ====================

  previewBccRelocation(familyId: string, targetBccId: string): Observable<ApiResponse<BccRelocationPreview>> {
    const params = new HttpParams().set('target_bcc_id', targetBccId);
    return this.http.get<ApiResponse<BccRelocationPreview>>(
      `${this.apiUrl}/${familyId}/relocate-bcc/preview`,
      { params, ...this.buildTenantCountryHeaders() }
    );
  }

  relocateBcc(familyId: string, payload: RelocateBccPayload): Observable<ApiResponse<Record<string, unknown>>> {
    return this.http.post<ApiResponse<Record<string, unknown>>>(
      `${this.apiUrl}/${familyId}/relocate-bcc`,
      payload,
      this.buildTenantCountryHeaders()
    );
  }

  marriageTransition(payload: MarriageTransitionPayload): Observable<ApiResponse<Record<string, unknown>>> {
    return this.http.post<ApiResponse<Record<string, unknown>>>(
      `${this.apiUrl}/marriage-transition`,
      payload,
      this.buildTenantCountryHeaders()
    );
  }

  getTransitionHistory(familyId: string): Observable<ApiResponse<FamilyTransitionHistoryRecord[]>> {
    return this.http.get<ApiResponse<FamilyTransitionHistoryRecord[]>>(
      `${this.apiUrl}/${familyId}/transition-history`,
      this.buildTenantCountryHeaders()
    );
  }
}

