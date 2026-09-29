import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SacramentTypeDto {
  id: number;
  name: string;
  code: string;
  category?: string;
  description?: string;
  display_order?: number;
  repeatable?: boolean;
  requires_minister?: boolean;
  minister_type?: string;
  active?: boolean;
  enabled_for_tenant?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface SacramentTypeResponse {
  success: boolean;
  data?: SacramentTypeDto[];
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SacramentTypeLookupService {
  private readonly baseUrl = `${environment.apiUrl}/sacraments/types`;

  constructor(private http: HttpClient) {}

  getSacramentTypes(): Observable<SacramentTypeResponse> {
    return this.http.get<SacramentTypeResponse>(this.baseUrl);
  }
}


