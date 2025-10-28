import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import {
  Sacrament,
  SacramentType,
  SacramentCreateRequest,
  SacramentUpdateRequest,
  SacramentListParams,
  SacramentResponse,
  SacramentListResponse,
  SacramentTypeResponse
} from '../models/sacrament.model';

@Injectable({
  providedIn: 'root'
})
export class SacramentService {
  private baseUrl = `${environment.apiUrl}/sacraments`;

  constructor(private http: HttpClient) {}

  /**
   * Get paginated list of sacraments with filtering
   */
  getSacraments(params?: SacramentListParams): Observable<SacramentListResponse> {
    let httpParams = new HttpParams();
    
    if (params) {
      Object.keys(params).forEach(key => {
        const value = (params as any)[key];
        if (value !== undefined && value !== null && value !== '') {
          httpParams = httpParams.set(key, value.toString());
        }
      });
    }

    return this.http.get<SacramentListResponse>(this.baseUrl, { params: httpParams });
  }

  /**
   * Get single sacrament by ID
   */
  getSacrament(id: number): Observable<SacramentResponse> {
    return this.http.get<SacramentResponse>(`${this.baseUrl}/${id}`);
  }

  /**
   * Create new sacrament record
   */
  createSacrament(data: SacramentCreateRequest): Observable<SacramentResponse> {
    return this.http.post<SacramentResponse>(this.baseUrl, data);
  }

  /**
   * Update existing sacrament record
   */
  updateSacrament(id: number, data: SacramentUpdateRequest): Observable<SacramentResponse> {
    return this.http.put<SacramentResponse>(`${this.baseUrl}/${id}`, data);
  }

  /**
   * Delete sacrament record
   */
  deleteSacrament(id: number): Observable<{success: boolean; message: string}> {
    return this.http.delete<{success: boolean; message: string}>(`${this.baseUrl}/${id}`);
  }

  /**
   * Get all sacrament types (for dropdowns)
   */
  getSacramentTypes(): Observable<SacramentTypeResponse> {
    return this.http.get<SacramentTypeResponse>(`${this.baseUrl}/types`);
  }
}

