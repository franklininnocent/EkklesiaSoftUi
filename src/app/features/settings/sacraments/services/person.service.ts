import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';

export interface ParishPerson {
  id: string;
  tenant_id: number;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  full_name_display?: string;
  date_of_birth?: string | null;
  place_of_birth?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  father_name?: string | null;
  mother_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  postal_code?: string | null;
  status?: string;
  active_family_member?: { id: string; family_id: string } | null;
}

export interface PersonMatch {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string | null;
  gender?: string | null;
  strength: 'strong' | 'medium';
  has_family: boolean;
}

export interface PersonSearchResponse {
  success: boolean;
  data: ParishPerson[];
  total?: number;
}

@Injectable({ providedIn: 'root' })
export class ParishPersonService {
  private readonly apiUrl = `${environment.apiUrl}/persons`;

  constructor(private readonly http: HttpClient) {}

  search(term: string, unaffiliated = false): Observable<PersonSearchResponse> {
    let params = new HttpParams().set('search', term).set('per_page', '12');
    if (unaffiliated) {
      params = params.set('unaffiliated', '1');
    }
    return this.http.get<PersonSearchResponse>(this.apiUrl, { params });
  }

  get(id: string): Observable<{ success: boolean; data: ParishPerson }> {
    return this.http.get<{ success: boolean; data: ParishPerson }>(`${this.apiUrl}/${id}`);
  }

  matches(payload: Partial<ParishPerson>): Observable<{ success: boolean; data: PersonMatch[] }> {
    return this.http.post<{ success: boolean; data: PersonMatch[] }>(`${this.apiUrl}/matches`, payload);
  }
}
