import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
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
   */
  getStatistics(): Observable<ApiResponse<BishopStatistics>> {
    return this.http.get<ApiResponse<BishopStatistics>>(`${this.baseUrl}/statistics`);
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

