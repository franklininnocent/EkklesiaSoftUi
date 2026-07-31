import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ParishZone, ApiResponse } from '../models/family.model';

@Injectable({
  providedIn: 'root'
})
export class ParishZoneService {
  private apiUrl = `${environment.apiUrl}/parish-zones`;

  constructor(private http: HttpClient) {}

  /**
   * Get all parish zones (for dropdowns)
   */
  getAll(): Observable<ApiResponse<ParishZone[]>> {
    return this.http.get<ApiResponse<ParishZone[]>>(this.apiUrl);
  }

  /**
   * Get active parish zones only
   */
  getActive(): Observable<ApiResponse<ParishZone[]>> {
    return this.http.get<ApiResponse<ParishZone[]>>(`${this.apiUrl}?active=true`);
  }

  /**
   * Get a single parish zone by ID
   */
  getById(id: string): Observable<ApiResponse<ParishZone>> {
    return this.http.get<ApiResponse<ParishZone>>(`${this.apiUrl}/${id}`);
  }
}


