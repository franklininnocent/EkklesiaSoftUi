import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import {
  ApiResponse,
  AssignLeadershipPayload,
  AuditLogListParams,
  CreateGuestMemberPayload,
  CreateOrganizationPayload,
  CurrentLeadershipResponse,
  DeletedOrganizationResult,
  EnrollFromFamilyPayload,
  EnrollMemberPayload,
  FamilyAffiliationsResponse,
  GuestMember,
  LeadershipHandoverPayload,
  LeadershipTerm,
  LinkGuestParishionerPayload,
  MembershipListParams,
  MinistriesAuditLogEntry,
  MinistriesDashboardSummary,
  ModuleStatus,
  Organization,
  OrganizationCategory,
  OrganizationListParams,
  OrganizationMembership,
  OrganizationSummary,
  OrganizationType,
  PaginatedApiResponse,
  ParishionerLookupResult,
  Position,
  ReEnrollMemberPayload,
  TerminateLeadershipPayload,
  UpdateGuestMemberPayload,
  UpdateMembershipStatusPayload,
  UpdateOrganizationPayload,
  UpdateOrganizationStatusPayload,
} from '../models/ministries.model';

type TaxonomyListParams = {
  page?: number;
  per_page?: number;
  search?: string;
  is_active?: boolean;
};

type GuestMemberListParams = {
  page?: number;
  per_page?: number;
  search?: string;
  guest_type?: string;
  has_linked_parishioner?: boolean;
};

type ParishionerLookupParams = {
  search?: string;
  exclude_organization_id?: string;
  page?: number;
  per_page?: number;
};

type LeadershipTimelineParams = {
  page?: number;
  per_page?: number;
  position_id?: string;
  status?: LeadershipTerm['status'];
};

type CreateOrganizationCategoryPayload = Pick<OrganizationCategory, 'code' | 'name'> &
  Partial<Pick<OrganizationCategory, 'description' | 'display_order' | 'is_active'>>;

type UpdateOrganizationCategoryPayload = Partial<
  Pick<OrganizationCategory, 'name' | 'description' | 'display_order' | 'is_active'>
>;

type UpdateTaxonomyStatusPayload = Pick<OrganizationCategory, 'is_active'>;

type CreateOrganizationTypePayload = Pick<OrganizationType, 'code' | 'name'> &
  Partial<Pick<OrganizationType, 'description' | 'display_order' | 'is_active'>>;

type UpdateOrganizationTypePayload = Partial<
  Pick<OrganizationType, 'name' | 'description' | 'display_order' | 'is_active'>
>;

type CreatePositionPayload = Pick<Position, 'code' | 'name'> &
  Partial<Pick<Position, 'description' | 'single_occupancy' | 'display_order' | 'is_active'>>;

type UpdatePositionPayload = Partial<
  Pick<Position, 'name' | 'description' | 'single_occupancy' | 'display_order' | 'is_active'>
>;

type LeadershipHandoverResult = {
  outgoing_term: LeadershipTerm;
  incoming_term: LeadershipTerm;
};

@Injectable({ providedIn: 'root' })
export class MinistriesApiService {
  private readonly baseUrl = `${environment.apiUrl}/tenant/ministries`;

  constructor(private http: HttpClient) {}

  getModuleStatus(): Observable<ApiResponse<ModuleStatus>> {
    return this.http.get<ApiResponse<ModuleStatus>>(`${this.baseUrl}/module-status`);
  }

  getDashboardSummary(): Observable<ApiResponse<MinistriesDashboardSummary>> {
    return this.http.get<ApiResponse<MinistriesDashboardSummary>>(`${this.baseUrl}/dashboard`);
  }

  listOrganizations(params: OrganizationListParams = {}): Observable<PaginatedApiResponse<Organization>> {
    return this.http.get<PaginatedApiResponse<Organization>>(`${this.baseUrl}/organizations`, {
      params: this.toHttpParams(params),
    });
  }

  createOrganization(payload: CreateOrganizationPayload): Observable<ApiResponse<Organization>> {
    return this.http.post<ApiResponse<Organization>>(`${this.baseUrl}/organizations`, payload);
  }

  getOrganization(id: string, include?: string): Observable<ApiResponse<Organization>> {
    const params = include ? this.toHttpParams({ include }) : undefined;
    return this.http.get<ApiResponse<Organization>>(`${this.baseUrl}/organizations/${id}`, { params });
  }

  updateOrganization(id: string, payload: UpdateOrganizationPayload): Observable<ApiResponse<Organization>> {
    return this.http.put<ApiResponse<Organization>>(`${this.baseUrl}/organizations/${id}`, payload);
  }

  updateOrganizationStatus(
    id: string,
    payload: UpdateOrganizationStatusPayload,
  ): Observable<ApiResponse<Organization>> {
    return this.http.patch<ApiResponse<Organization>>(`${this.baseUrl}/organizations/${id}/status`, payload);
  }

  deleteOrganization(id: string): Observable<ApiResponse<DeletedOrganizationResult>> {
    return this.http.delete<ApiResponse<DeletedOrganizationResult>>(`${this.baseUrl}/organizations/${id}`);
  }

  restoreOrganization(id: string): Observable<ApiResponse<Organization>> {
    return this.http.post<ApiResponse<Organization>>(`${this.baseUrl}/organizations/${id}/restore`, {});
  }

  getOrganizationSummary(id: string): Observable<ApiResponse<OrganizationSummary>> {
    return this.http.get<ApiResponse<OrganizationSummary>>(`${this.baseUrl}/organizations/${id}/summary`);
  }

  listMembers(
    orgId: string,
    params: MembershipListParams = {},
  ): Observable<PaginatedApiResponse<OrganizationMembership>> {
    return this.http.get<PaginatedApiResponse<OrganizationMembership>>(
      `${this.baseUrl}/organizations/${orgId}/members`,
      { params: this.toHttpParams(params) },
    );
  }

  enrollMember(orgId: string, payload: EnrollMemberPayload): Observable<ApiResponse<OrganizationMembership>> {
    return this.http.post<ApiResponse<OrganizationMembership>>(
      `${this.baseUrl}/organizations/${orgId}/members`,
      payload,
    );
  }

  updateMemberStatus(
    orgId: string,
    membershipId: string,
    payload: UpdateMembershipStatusPayload,
  ): Observable<ApiResponse<OrganizationMembership>> {
    return this.http.patch<ApiResponse<OrganizationMembership>>(
      `${this.baseUrl}/organizations/${orgId}/members/${membershipId}/status`,
      payload,
    );
  }

  reEnrollMember(
    orgId: string,
    membershipId: string,
    payload: ReEnrollMemberPayload,
  ): Observable<ApiResponse<OrganizationMembership>> {
    return this.http.post<ApiResponse<OrganizationMembership>>(
      `${this.baseUrl}/organizations/${orgId}/members/${membershipId}/re-enroll`,
      payload,
    );
  }

  getCurrentLeadership(orgId: string): Observable<ApiResponse<CurrentLeadershipResponse>> {
    return this.http.get<ApiResponse<CurrentLeadershipResponse>>(
      `${this.baseUrl}/organizations/${orgId}/leadership/current`,
    );
  }

  getLeadershipTimeline(
    orgId: string,
    params: LeadershipTimelineParams = {},
  ): Observable<PaginatedApiResponse<LeadershipTerm>> {
    return this.http.get<PaginatedApiResponse<LeadershipTerm>>(
      `${this.baseUrl}/organizations/${orgId}/leadership/timeline`,
      { params: this.toHttpParams(params) },
    );
  }

  assignLeadership(orgId: string, payload: AssignLeadershipPayload): Observable<ApiResponse<LeadershipTerm>> {
    return this.http.post<ApiResponse<LeadershipTerm>>(
      `${this.baseUrl}/organizations/${orgId}/leadership/assign`,
      payload,
    );
  }

  handoverLeadership(
    orgId: string,
    payload: LeadershipHandoverPayload,
  ): Observable<ApiResponse<LeadershipHandoverResult>> {
    return this.http.post<ApiResponse<LeadershipHandoverResult>>(
      `${this.baseUrl}/organizations/${orgId}/leadership/handover`,
      payload,
    );
  }

  terminateLeadership(
    orgId: string,
    termId: string,
    payload: TerminateLeadershipPayload,
  ): Observable<ApiResponse<LeadershipTerm>> {
    return this.http.post<ApiResponse<LeadershipTerm>>(
      `${this.baseUrl}/organizations/${orgId}/leadership/${termId}/terminate`,
      payload,
    );
  }

  listGuestMembers(params: GuestMemberListParams = {}): Observable<PaginatedApiResponse<GuestMember>> {
    return this.http.get<PaginatedApiResponse<GuestMember>>(`${this.baseUrl}/guest-members`, {
      params: this.toHttpParams(params),
    });
  }

  createGuestMember(payload: CreateGuestMemberPayload): Observable<ApiResponse<GuestMember>> {
    return this.http.post<ApiResponse<GuestMember>>(`${this.baseUrl}/guest-members`, payload);
  }

  getGuestMember(id: string): Observable<ApiResponse<GuestMember>> {
    return this.http.get<ApiResponse<GuestMember>>(`${this.baseUrl}/guest-members/${id}`);
  }

  updateGuestMember(id: string, payload: UpdateGuestMemberPayload): Observable<ApiResponse<GuestMember>> {
    return this.http.put<ApiResponse<GuestMember>>(`${this.baseUrl}/guest-members/${id}`, payload);
  }

  linkGuestParishioner(id: string, payload: LinkGuestParishionerPayload): Observable<ApiResponse<GuestMember>> {
    return this.http.post<ApiResponse<GuestMember>>(
      `${this.baseUrl}/guest-members/${id}/link-parishioner`,
      payload,
    );
  }

  lookupParishioners(params: ParishionerLookupParams = {}): Observable<PaginatedApiResponse<ParishionerLookupResult>> {
    return this.http.get<PaginatedApiResponse<ParishionerLookupResult>>(`${this.baseUrl}/parishioners/lookup`, {
      params: this.toHttpParams(params),
    });
  }

  getFamilyAffiliations(familyMemberId: string): Observable<ApiResponse<FamilyAffiliationsResponse>> {
    return this.http.get<ApiResponse<FamilyAffiliationsResponse>>(
      `${this.baseUrl}/family-members/${familyMemberId}/affiliations`,
    );
  }

  enrollFromFamily(
    familyMemberId: string,
    payload: EnrollFromFamilyPayload,
  ): Observable<ApiResponse<OrganizationMembership>> {
    return this.http.post<ApiResponse<OrganizationMembership>>(
      `${this.baseUrl}/family-members/${familyMemberId}/enroll`,
      payload,
    );
  }

  listCategories(params: TaxonomyListParams = {}): Observable<PaginatedApiResponse<OrganizationCategory>> {
    return this.http.get<PaginatedApiResponse<OrganizationCategory>>(`${this.baseUrl}/categories`, {
      params: this.toHttpParams(params),
    });
  }

  createCategory(payload: CreateOrganizationCategoryPayload): Observable<ApiResponse<OrganizationCategory>> {
    return this.http.post<ApiResponse<OrganizationCategory>>(`${this.baseUrl}/categories`, payload);
  }

  updateCategory(id: string, payload: UpdateOrganizationCategoryPayload): Observable<ApiResponse<OrganizationCategory>> {
    return this.http.put<ApiResponse<OrganizationCategory>>(`${this.baseUrl}/categories/${id}`, payload);
  }

  updateCategoryStatus(
    id: string,
    payload: UpdateTaxonomyStatusPayload,
  ): Observable<ApiResponse<OrganizationCategory>> {
    return this.http.patch<ApiResponse<OrganizationCategory>>(`${this.baseUrl}/categories/${id}/status`, payload);
  }

  listTypes(params: TaxonomyListParams = {}): Observable<PaginatedApiResponse<OrganizationType>> {
    return this.http.get<PaginatedApiResponse<OrganizationType>>(`${this.baseUrl}/types`, {
      params: this.toHttpParams(params),
    });
  }

  createType(payload: CreateOrganizationTypePayload): Observable<ApiResponse<OrganizationType>> {
    return this.http.post<ApiResponse<OrganizationType>>(`${this.baseUrl}/types`, payload);
  }

  updateType(id: string, payload: UpdateOrganizationTypePayload): Observable<ApiResponse<OrganizationType>> {
    return this.http.put<ApiResponse<OrganizationType>>(`${this.baseUrl}/types/${id}`, payload);
  }

  updateTypeStatus(id: string, payload: UpdateTaxonomyStatusPayload): Observable<ApiResponse<OrganizationType>> {
    return this.http.patch<ApiResponse<OrganizationType>>(`${this.baseUrl}/types/${id}/status`, payload);
  }

  listPositions(params: TaxonomyListParams = {}): Observable<PaginatedApiResponse<Position>> {
    return this.http.get<PaginatedApiResponse<Position>>(`${this.baseUrl}/positions`, {
      params: this.toHttpParams(params),
    });
  }

  createPosition(payload: CreatePositionPayload): Observable<ApiResponse<Position>> {
    return this.http.post<ApiResponse<Position>>(`${this.baseUrl}/positions`, payload);
  }

  updatePosition(id: string, payload: UpdatePositionPayload): Observable<ApiResponse<Position>> {
    return this.http.put<ApiResponse<Position>>(`${this.baseUrl}/positions/${id}`, payload);
  }

  updatePositionStatus(id: string, payload: UpdateTaxonomyStatusPayload): Observable<ApiResponse<Position>> {
    return this.http.patch<ApiResponse<Position>>(`${this.baseUrl}/positions/${id}/status`, payload);
  }

  listAuditLogs(params: AuditLogListParams = {}): Observable<PaginatedApiResponse<MinistriesAuditLogEntry>> {
    return this.http.get<PaginatedApiResponse<MinistriesAuditLogEntry>>(`${this.baseUrl}/audit-logs`, {
      params: this.toHttpParams(params),
    });
  }

  listOrganizationAuditLogs(
    orgId: string,
    params: AuditLogListParams = {},
  ): Observable<PaginatedApiResponse<MinistriesAuditLogEntry>> {
    return this.http.get<PaginatedApiResponse<MinistriesAuditLogEntry>>(
      `${this.baseUrl}/organizations/${orgId}/audit-logs`,
      { params: this.toHttpParams(params) },
    );
  }

  private toHttpParams(params: object): HttpParams {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        // Laravel's `boolean` rule accepts 1/0 (and "1"/"0"), not the strings "true"/"false".
        const serialized = typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
        httpParams = httpParams.set(key, serialized);
      }
    });
    return httpParams;
  }
}
