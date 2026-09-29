import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '@environments/environment';
import {
  PersonIdentityReconcileRequest,
  SacramentContextQuery,
  SacramentContextResponse,
} from '../models/sacrament-context.model';
import { ParishPerson } from './person.service';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class SacramentPersonContextService {
  private readonly sacramentsUrl = `${environment.apiUrl}/sacraments`;
  private readonly personsUrl = `${environment.apiUrl}/persons`;

  constructor(private readonly http: HttpClient) {}

  getContext(query: SacramentContextQuery): Observable<SacramentContextResponse> {
    let params = new HttpParams().set('workflow', query.workflow);
    if (query.family_member_id) {
      params = params.set('family_member_id', query.family_member_id);
    }
    if (query.person_id) {
      params = params.set('person_id', query.person_id);
    }
    if (query.participant_role) {
      params = params.set('participant_role', query.participant_role);
    }
    if (query.sacrament_id) {
      params = params.set('sacrament_id', String(query.sacrament_id));
    }

    return this.http
      .get<ApiResponse<SacramentContextResponse>>(`${this.sacramentsUrl}/context`, { params })
      .pipe(map((res) => res.data));
  }

  reconcileIdentity(personId: string, payload: PersonIdentityReconcileRequest): Observable<ParishPerson> {
    return this.http
      .post<ApiResponse<ParishPerson>>(`${this.personsUrl}/${personId}/reconcile-identity`, payload)
      .pipe(map((res) => res.data));
  }
}
