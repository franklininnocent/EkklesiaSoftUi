import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { tap, shareReplay, catchError } from 'rxjs/operators';
import { environment } from '@environments/environment';
import { 
  Bishop, 
  BishopCreateRequest, 
  BishopUpdateRequest,
  BishopListParams,
  BishopStatistics,
  BishopAppointment,
  CreateAppointmentRequest,
  EndAppointmentRequest,
} from '@core/models/ecclesiastical';
import { ApiResponse, PaginatedResponse } from '@core/models';

/**
 * Bishop list API may return paginated rows at `data.data` or, if mis-wrapped,
 * at `data.data.data`. This helper normalizes both shapes.
 */
export function extractBishopList(response: ApiResponse<any> | null | undefined): Bishop[] {
  const payload = response?.data;
  if (Array.isArray(payload)) {
    return payload;
  }
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const first = payload.data;
  if (Array.isArray(first)) {
    return first;
  }
  if (first && typeof first === 'object' && Array.isArray(first.data)) {
    return first.data;
  }

  return [];
}

export function extractBishopPagination(response: ApiResponse<any> | null | undefined): {
  total: number;
  currentPage: number;
  lastPage: number;
} {
  const payload = response?.data;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { total: 0, currentPage: 1, lastPage: 1 };
  }

  return {
    total: payload.total ?? 0,
    currentPage: payload.current_page ?? 1,
    lastPage: payload.last_page ?? 1,
  };
}

@Injectable({
  providedIn: 'root'
})
export class BishopService {
  private baseUrl = `${environment.apiUrl}/ecclesiastical/bishops`;

  // Cache for statistics (10 minutes)
  private statisticsCache$: Observable<ApiResponse<BishopStatistics>> | null = null;
  private statisticsCacheTime: number = 0;
  private readonly STATISTICS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  constructor(private http: HttpClient) {}

  /**
   * Get paginated list of bishops with optional filters
   */
  getBishops(params?: BishopListParams): Observable<ApiResponse<PaginatedResponse<Bishop>>> {
    let httpParams = new HttpParams();
    
    if (params) {
      Object.keys(params).forEach(key => {
        const value = (params as any)[key];
        if (value !== undefined && value !== null) {
          httpParams = httpParams.set(key, value.toString());
        }
      });
    }

    return this.http.get<ApiResponse<PaginatedResponse<Bishop>>>(this.baseUrl, { params: httpParams });
  }

  /**
   * Get single bishop by ID
   */
  getBishop(id: number): Observable<ApiResponse<Bishop>> {
    return this.http.get<ApiResponse<Bishop>>(`${this.baseUrl}/${id}`);
  }

  /**
   * Create new bishop
   */
  createBishop(data: BishopCreateRequest): Observable<ApiResponse<Bishop>> {
    return this.http.post<ApiResponse<Bishop>>(this.baseUrl, data).pipe(
      tap(() => this.clearCache())
    );
  }

  /**
   * Update existing bishop
   */
  updateBishop(id: number, data: BishopUpdateRequest): Observable<ApiResponse<Bishop>> {
    return this.http.put<ApiResponse<Bishop>>(`${this.baseUrl}/${id}`, data).pipe(
      tap(() => this.clearCache())
    );
  }

  /**
   * Delete bishop
   */
  deleteBishop(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/${id}`).pipe(
      tap(() => this.clearCache())
    );
  }

  /**
   * Get bishop statistics
   * Results are cached for 10 minutes to improve performance
   */
  getStatistics(forceRefresh: boolean = false): Observable<ApiResponse<BishopStatistics>> {
    const now = Date.now();
    const cacheValid = this.statisticsCache$ && 
                      (now - this.statisticsCacheTime) < this.STATISTICS_CACHE_TTL;

    if (!forceRefresh && cacheValid) {
      return this.statisticsCache$!;
    }

    this.statisticsCache$ = this.http.get<ApiResponse<BishopStatistics>>(`${this.baseUrl}/statistics`).pipe(
      tap(() => {
        this.statisticsCacheTime = Date.now();
      }),
      shareReplay(1),
      catchError(error => {
        this.statisticsCache$ = null;
        throw error;
      })
    );

    return this.statisticsCache$;
  }

  /**
   * Clear all caches (call after create/update/delete operations)
   */
  clearCache(): void {
    this.statisticsCache$ = null;
    this.statisticsCacheTime = 0;
  }

  /**
   * Get bishops by diocese
   */
  getBishopsByDiocese(dioceseId: number, currentOnly = true): Observable<ApiResponse<Bishop[]>> {
    let params = new HttpParams();
    if (!currentOnly) {
      params = params.set('current_only', 'false');
    }
    return this.http.get<ApiResponse<Bishop[]>>(`${this.baseUrl}/diocese/${dioceseId}`, { params });
  }

  /**
   * Get bishops by title
   */
  getBishopsByTitle(titleId: number): Observable<ApiResponse<Bishop[]>> {
    return this.http.get<ApiResponse<Bishop[]>>(`${this.baseUrl}/title/${titleId}`);
  }

  getAppointments(bishopId: number, params?: { page?: number; per_page?: number }): Observable<ApiResponse<{
    data: BishopAppointment[];
    total: number;
    current_page: number;
    last_page: number;
    per_page: number;
  }>> {
    let httpParams = new HttpParams();
    if (params?.page) {
      httpParams = httpParams.set('page', String(params.page));
    }
    if (params?.per_page) {
      httpParams = httpParams.set('per_page', String(params.per_page));
    }
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/${bishopId}/appointments`, { params: httpParams });
  }

  createAppointment(bishopId: number, data: CreateAppointmentRequest): Observable<ApiResponse<BishopAppointment>> {
    return this.http.post<ApiResponse<BishopAppointment>>(`${this.baseUrl}/${bishopId}/appointments`, data).pipe(
      tap(() => this.clearCache())
    );
  }

  endAppointment(appointmentId: string, data: EndAppointmentRequest): Observable<ApiResponse<BishopAppointment>> {
    return this.http.post<ApiResponse<BishopAppointment>>(
      `${environment.apiUrl}/ecclesiastical/appointments/${appointmentId}/end`,
      data
    ).pipe(tap(() => this.clearCache()));
  }

  activateAppointment(appointmentId: string): Observable<ApiResponse<BishopAppointment>> {
    return this.http.post<ApiResponse<BishopAppointment>>(
      `${environment.apiUrl}/ecclesiastical/appointments/${appointmentId}/activate`,
      {}
    ).pipe(tap(() => this.clearCache()));
  }

  getAuditHistory(bishopId: number): Observable<ApiResponse<unknown[]>> {
    return this.http.get<ApiResponse<unknown[]>>(`${this.baseUrl}/${bishopId}/audit-history`);
  }

  uploadPhoto(bishopId: number, file: File): Observable<ApiResponse<{
    photo_path: string;
    photo_url?: string;
    photo_public_url: string;
    has_photo?: boolean;
  }>> {
    const formData = new FormData();
    formData.append('image', file);
    return this.http.post<ApiResponse<{
      photo_path: string;
      photo_url?: string;
      photo_public_url: string;
      has_photo?: boolean;
    }>>(
      `${this.baseUrl}/${bishopId}/upload-photo`,
      formData
    ).pipe(tap(() => this.clearCache()));
  }

  deletePhoto(bishopId: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/${bishopId}/photo`).pipe(
      tap(() => this.clearCache())
    );
  }
}

