import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import {
  SacramentType,
  SacramentTypeCreateRequest,
  SacramentTypeUpdateRequest,
  SacramentTypeListParams,
  SacramentTypeStatistics
} from '../models/sacrament-type.model';
import { ApiResponse, PaginatedResponse } from '@core/models/api-response.model';

@Injectable({
  providedIn: 'root'
})
export class SacramentTypeService {
  private apiUrl = `${environment.apiUrl}/ecclesiastical/sacrament-types`;

  constructor(private http: HttpClient) {}

  /**
   * Get paginated list of sacrament types
   */
  getSacramentTypes(params?: SacramentTypeListParams): Observable<ApiResponse<PaginatedResponse<SacramentType>>> {
    let httpParams = new HttpParams();

    if (params) {
      Object.keys(params).forEach(key => {
        const value = (params as any)[key];
        if (value !== undefined && value !== null && value !== '') {
          httpParams = httpParams.set(key, value.toString());
        }
      });
    }

    return this.http.get<ApiResponse<PaginatedResponse<SacramentType>>>(this.apiUrl, { params: httpParams });
  }

  /**
   * Get single sacrament type by ID
   */
  getSacramentTypeById(id: number): Observable<ApiResponse<SacramentType>> {
    return this.http.get<ApiResponse<SacramentType>>(`${this.apiUrl}/${id}`);
  }

  /**
   * Create new sacrament type
   */
  createSacramentType(data: SacramentTypeCreateRequest): Observable<ApiResponse<SacramentType>> {
    return this.http.post<ApiResponse<SacramentType>>(this.apiUrl, data);
  }

  /**
   * Update existing sacrament type
   */
  updateSacramentType(id: number, data: SacramentTypeUpdateRequest): Observable<ApiResponse<SacramentType>> {
    return this.http.put<ApiResponse<SacramentType>>(`${this.apiUrl}/${id}`, data);
  }

  /**
   * Delete sacrament type
   */
  deleteSacramentType(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}`);
  }

  /**
   * Get sacrament type statistics
   */
  getStatistics(): Observable<ApiResponse<SacramentTypeStatistics>> {
    return this.http.get<ApiResponse<SacramentTypeStatistics>>(`${this.apiUrl}/statistics`);
  }
}


