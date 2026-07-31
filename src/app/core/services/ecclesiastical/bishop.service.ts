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
  BishopStatistics 
} from '@core/models/ecclesiastical';
import { ApiResponse, PaginatedResponse } from '@core/models';

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
    return this.http.post<ApiResponse<Bishop>>(this.baseUrl, data);
  }

  /**
   * Update existing bishop
   */
  updateBishop(id: number, data: BishopUpdateRequest): Observable<ApiResponse<Bishop>> {
    return this.http.put<ApiResponse<Bishop>>(`${this.baseUrl}/${id}`, data);
  }

  /**
   * Delete bishop
   */
  deleteBishop(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/${id}`);
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
  getBishopsByDiocese(dioceseId: number): Observable<ApiResponse<Bishop[]>> {
    return this.http.get<ApiResponse<Bishop[]>>(`${this.baseUrl}/diocese/${dioceseId}`);
  }

  /**
   * Get bishops by title
   */
  getBishopsByTitle(titleId: number): Observable<ApiResponse<Bishop[]>> {
    return this.http.get<ApiResponse<Bishop[]>>(`${this.baseUrl}/title/${titleId}`);
  }
}

