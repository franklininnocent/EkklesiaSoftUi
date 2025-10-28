import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { 
  Diocese, 
  DioceseCreateRequest, 
  DioceseUpdateRequest,
  DioceseListParams,
  DioceseStatistics 
} from '@core/models/ecclesiastical';
import { ApiResponse, PaginatedResponse } from '@core/models';

@Injectable({
  providedIn: 'root'
})
export class DioceseService {
  private baseUrl = `${environment.apiUrl}/ecclesiastical/dioceses`;

  constructor(private http: HttpClient) {}

  /**
   * Get paginated list of dioceses with optional filters
   */
  getDioceses(params?: DioceseListParams): Observable<ApiResponse<PaginatedResponse<Diocese>>> {
    let httpParams = new HttpParams();
    
    if (params) {
      Object.keys(params).forEach(key => {
        const value = (params as any)[key];
        if (value !== undefined && value !== null) {
          httpParams = httpParams.set(key, value.toString());
        }
      });
    }

    return this.http.get<ApiResponse<PaginatedResponse<Diocese>>>(this.baseUrl, { params: httpParams });
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
   */
  getStatistics(): Observable<ApiResponse<DioceseStatistics>> {
    return this.http.get<ApiResponse<DioceseStatistics>>(`${this.baseUrl}/statistics`);
  }

  /**
   * Get dioceses by country
   */
  getDiocesesByCountry(countryId: number): Observable<ApiResponse<Diocese[]>> {
    return this.http.get<ApiResponse<Diocese[]>>(`${this.baseUrl}/country/${countryId}`);
  }

  /**
   * Get only archdioceses
   */
  getArchdioceses(): Observable<ApiResponse<Diocese[]>> {
    return this.http.get<ApiResponse<Diocese[]>>(`${this.baseUrl}/archdioceses`);
  }
}

