import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { FamilyMember, PaginatedResponse, ApiResponse } from '@core/models/family.model';

export interface MemberFilters {
  search?: string;
  status?: string;
  bcc_id?: string;
  is_head?: boolean | string;
  progression?:
    | 'baptized_without_communion'
    | 'baptized_without_confirmation'
    | 'female_unmarried_over_18'
    | 'male_unmarried_over_23';
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

@Injectable({
  providedIn: 'root'
})
export class MemberService {
  private apiUrl = `${environment.apiUrl}/members`;

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
   * Get paginated list of all members across families
   */
  getMembers(filters: MemberFilters = {}): Observable<PaginatedResponse<FamilyMember>> {
    let params = new HttpParams();
    
    if (filters.search) params = params.set('search', filters.search);
    if (filters.status) params = params.set('status', filters.status);
    if (filters.bcc_id) params = params.set('bcc_id', filters.bcc_id);
    if (filters.is_head !== undefined) {
      // Convert boolean to string 'true' or 'false' for backend
      const isHeadValue = typeof filters.is_head === 'boolean' 
        ? (filters.is_head ? 'true' : 'false')
        : filters.is_head.toString();
      params = params.set('is_head', isHeadValue);
    }
    if (filters.progression) params = params.set('progression', filters.progression);
    if (filters.sort_by) params = params.set('sort_by', filters.sort_by);
    if (filters.sort_order) params = params.set('sort_order', filters.sort_order);
    // Always set per_page and page to ensure pagination works
    params = params.set('per_page', (filters.per_page || 20).toString());
    params = params.set('page', (filters.page || 1).toString());

    return this.http.get<PaginatedResponse<FamilyMember>>(this.apiUrl, { 
      params, 
      ...this.buildTenantCountryHeaders() 
    });
  }

  /**
   * Get a single member by ID (via family)
   */
  getMember(familyId: string, memberId: string): Observable<ApiResponse<FamilyMember>> {
    return this.http.get<ApiResponse<FamilyMember>>(
      `${environment.apiUrl}/families/${familyId}/members/${memberId}`,
      this.buildTenantCountryHeaders()
    );
  }
}

