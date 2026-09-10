import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap, shareReplay, catchError, map } from 'rxjs/operators';
import { environment } from '@environments/environment';
import { 
  Diocese, 
  DioceseCreateRequest, 
  DioceseUpdateRequest,
  DioceseListParams,
  DioceseStatistics,
  DiocesanLeadership,
  BishopAppointment,
  ReplaceOrdinaryRequest,
  ReplaceOrdinaryResponse,
} from '@core/models/ecclesiastical';
import { ApiResponse } from '@core/models';

const DIOCESE_DROPDOWN_PAGE_SIZE = 1000;

/**
 * Diocese list API returns either a top-level array (`data: Diocese[]`)
 * or a nested Laravel paginator (`data.data`). Dropdowns must accept both.
 */
export function extractDioceseList(response: ApiResponse<any> | null | undefined): Diocese[] {
  const payload = response?.data;
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && Array.isArray(payload.data)) {
    return payload.data;
  }
  return [];
}

@Injectable({
  providedIn: 'root'
})
export class DioceseService {
  private baseUrl = `${environment.apiUrl}/ecclesiastical/dioceses`;

  // Cache for statistics (10 minutes)
  private statisticsCache$: Observable<ApiResponse<DioceseStatistics>> | null = null;
  private statisticsCacheTime: number = 0;
  private readonly STATISTICS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  // Cache for archdioceses (30 minutes)
  private archdiocesesCache$: Observable<ApiResponse<Diocese[]>> | null = null;
  private archdiocesesCacheTime: number = 0;
  private readonly ARCHDIOCESES_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  constructor(private http: HttpClient) {}

  // Cache for paginated lists (2 minutes)
  private listCache = new Map<string, { data: ApiResponse<any>; timestamp: number }>();
  private readonly LIST_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

  /**
   * Get paginated list of dioceses using traditional Laravel pagination
   * All filtering and sorting happens server-side
   * Results are cached for 2 minutes to improve performance
   */
  getDioceses(params?: DioceseListParams, forceRefresh: boolean = false): Observable<ApiResponse<any>> {
    // Generate cache key from params
    const cacheKey = JSON.stringify(params || {});
    const now = Date.now();
    
    // Check cache if not forcing refresh
    if (!forceRefresh) {
      const cached = this.listCache.get(cacheKey);
      if (cached && (now - cached.timestamp) < this.LIST_CACHE_TTL) {
        return of(cached.data);
      }
    }

    let httpParams = new HttpParams();
    
    if (params) {
      Object.keys(params).forEach(key => {
        const value = (params as any)[key];
        if (value !== undefined && value !== null && value !== '') {
          httpParams = httpParams.set(key, value.toString());
        }
      });
    }

    return this.http.get<ApiResponse<any>>(this.baseUrl, { params: httpParams }).pipe(
      tap(response => {
        // Cache response if not forcing refresh
        if (!forceRefresh) {
          this.listCache.set(cacheKey, { data: response, timestamp: now });
          
          // Clean up old cache entries (keep only last 10)
          if (this.listCache.size > 10) {
            const oldestKey = Array.from(this.listCache.entries())
              .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
            this.listCache.delete(oldestKey);
          }
        }
      }),
      shareReplay(1)
    );
  }

  /**
   * Get single diocese by ID
   */
  getDiocese(id: number): Observable<ApiResponse<Diocese>> {
    return this.http.get<ApiResponse<Diocese>>(`${this.baseUrl}/${id}`);
  }

  /**
   * Create new diocese
   */
  createDiocese(data: DioceseCreateRequest): Observable<ApiResponse<Diocese>> {
    return this.http.post<ApiResponse<Diocese>>(this.baseUrl, data);
  }

  /**
   * Update existing diocese
   */
  updateDiocese(id: number, data: DioceseUpdateRequest): Observable<ApiResponse<Diocese>> {
    return this.http.put<ApiResponse<Diocese>>(`${this.baseUrl}/${id}`, data);
  }

  /**
   * Delete diocese
   */
  deleteDiocese(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/${id}`);
  }

  /**
   * Get diocese statistics
   * Results are cached for 10 minutes to improve performance
   */
  getStatistics(forceRefresh: boolean = false): Observable<ApiResponse<DioceseStatistics>> {
    const now = Date.now();
    const cacheValid = this.statisticsCache$ && 
                      (now - this.statisticsCacheTime) < this.STATISTICS_CACHE_TTL;

    if (!forceRefresh && cacheValid) {
      return this.statisticsCache$!;
    }

    this.statisticsCache$ = this.http.get<ApiResponse<DioceseStatistics>>(`${this.baseUrl}/statistics`).pipe(
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
   * Flat list for diocese dropdowns (Create Bishop, filters).
   * Requests a large page and normalizes both API response shapes.
   */
  getDioceseOptions(forceRefresh: boolean = false): Observable<Diocese[]> {
    return this.getDioceses(
      { per_page: DIOCESE_DROPDOWN_PAGE_SIZE, page: 1, sort_by: 'name' },
      forceRefresh
    ).pipe(map(response => extractDioceseList(response)));
  }

  /**
   * Get dioceses by country
   */
  getDiocesesByCountry(countryId: number): Observable<ApiResponse<Diocese[]>> {
    return this.http.get<ApiResponse<Diocese[]>>(`${this.baseUrl}/country/${countryId}`);
  }

  /**
   * Get only archdioceses
   * Results are cached for 30 minutes to improve performance
   */
  getArchdioceses(forceRefresh: boolean = false): Observable<ApiResponse<Diocese[]>> {
    const now = Date.now();
    const cacheValid = this.archdiocesesCache$ && 
                      (now - this.archdiocesesCacheTime) < this.ARCHDIOCESES_CACHE_TTL;

    if (!forceRefresh && cacheValid) {
      return this.archdiocesesCache$!;
    }

    this.archdiocesesCache$ = this.http.get<ApiResponse<Diocese[]>>(`${this.baseUrl}/archdioceses`).pipe(
      tap(() => {
        this.archdiocesesCacheTime = Date.now();
      }),
      shareReplay(1),
      catchError(error => {
        this.archdiocesesCache$ = null;
        throw error;
      })
    );

    return this.archdiocesesCache$;
  }

  /**
   * Current diocesan leadership (ordinary + current appointments).
   */
  getLeadership(dioceseId: number): Observable<ApiResponse<DiocesanLeadership>> {
    return this.http.get<ApiResponse<DiocesanLeadership>>(
      `${this.baseUrl}/${dioceseId}/leadership`
    );
  }

  /**
   * Historical bishop appointments for a diocese.
   */
  getLeadershipHistory(
    dioceseId: number,
    params?: { page?: number; per_page?: number; canonical_role?: string }
  ): Observable<ApiResponse<{
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
    if (params?.canonical_role) {
      httpParams = httpParams.set('canonical_role', params.canonical_role);
    }

    return this.http.get<ApiResponse<any>>(
      `${this.baseUrl}/${dioceseId}/leadership/history`,
      { params: httpParams }
    );
  }

  /**
   * Atomically end the current ordinary and appoint a successor.
   */
  replaceOrdinary(
    dioceseId: number,
    payload: ReplaceOrdinaryRequest
  ): Observable<ApiResponse<ReplaceOrdinaryResponse>> {
    return this.http.post<ApiResponse<ReplaceOrdinaryResponse>>(
      `${this.baseUrl}/${dioceseId}/succession/replace-ordinary`,
      payload
    );
  }

  /**
   * Clear all caches (call after create/update/delete operations)
   */
  clearCache(): void {
    this.statisticsCache$ = null;
    this.statisticsCacheTime = 0;
    this.archdiocesesCache$ = null;
    this.archdiocesesCacheTime = 0;
    this.listCache.clear();
  }
}

