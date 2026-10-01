import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { FamilyMember, PaginatedResponse, ApiResponse } from '@core/models/family.model';

export interface MemberCelebrationItem {
  id: string;
  family_id?: string;
  name: string;
  day_label: string;
  date_label: string;
  detail: string;
  event_date: string;
  family_name?: string | null;
  family_code?: string | null;
  bcc_id?: string | null;
  bcc_name?: string | null;
}

export interface MemberCelebrationsResponse {
  week: {
    start: string;
    end: string;
    label: string;
    timezone: string;
  };
  birthdays: MemberCelebrationItem[];
  anniversaries: MemberCelebrationItem[];
}

export type MemberCelebrationListType = 'birthdays' | 'anniversaries';

export interface MemberCelebrationsListFilters {
  type: MemberCelebrationListType;
  from?: string;
  to?: string;
  search?: string;
  bcc_id?: string;
  event_date?: string;
  event_date_from?: string;
  event_date_to?: string;
  sort_by?: 'event_date' | 'name' | 'family_name' | 'bcc_name';
  sort_order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface MemberCelebrationsListResponse extends PaginatedResponse<MemberCelebrationItem> {
  window: {
    start: string;
    end: string;
    label: string;
    timezone: string;
  };
  type: MemberCelebrationListType;
}

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
  age_band?: string;
  family_status?: string;
  gender?: string;
  missing?: string;
  occupation?: string;
  education?: string;
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
   * Birthdays and anniversaries for the current parish week (server-side, tenant timezone).
   */
  getCelebrations(): Observable<ApiResponse<MemberCelebrationsResponse>> {
    return this.http.get<ApiResponse<MemberCelebrationsResponse>>(
      `${this.apiUrl}/celebrations`,
      this.buildTenantCountryHeaders()
    );
  }

  /** Paginated birthdays or anniversaries for the parish week or an explicit from/to range (server-side). */
  getCelebrationsList(
    filters: MemberCelebrationsListFilters
  ): Observable<MemberCelebrationsListResponse> {
    let params = new HttpParams()
      .set('type', filters.type)
      .set('sort_by', filters.sort_by || 'event_date')
      .set('sort_order', filters.sort_order || 'asc')
      .set('per_page', (filters.per_page || 20).toString())
      .set('page', (filters.page || 1).toString());

    if (filters.from) {
      params = params.set('from', filters.from);
    }
    if (filters.to) {
      params = params.set('to', filters.to);
    }
    if (filters.search) {
      params = params.set('search', filters.search);
    }
    if (filters.bcc_id) {
      params = params.set('bcc_id', filters.bcc_id);
    }
    if (filters.event_date_from && filters.event_date_to) {
      params = params.set('event_date_from', filters.event_date_from);
      params = params.set('event_date_to', filters.event_date_to);
    } else if (filters.event_date) {
      params = params.set('event_date', filters.event_date);
    }

    return this.http.get<MemberCelebrationsListResponse>(
      `${this.apiUrl}/celebrations/list`,
      { params, ...this.buildTenantCountryHeaders() }
    );
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
    if (filters.age_band) params = params.set('age_band', filters.age_band);
    if (filters.family_status) params = params.set('family_status', filters.family_status);
    if (filters.gender) params = params.set('gender', filters.gender);
    if (filters.missing) params = params.set('missing', filters.missing);
    if (filters.occupation) params = params.set('occupation', filters.occupation);
    if (filters.education) params = params.set('education', filters.education);
    params = params.set('sort_by', filters.sort_by || 'name');
    params = params.set('sort_order', filters.sort_order || 'asc');
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

