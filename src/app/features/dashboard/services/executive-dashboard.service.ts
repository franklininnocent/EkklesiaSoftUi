import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '@environments/environment';
import { ExecutiveDashboardPayload } from '../models/executive-dashboard.model';

@Injectable({ providedIn: 'root' })
export class ExecutiveDashboardService {
  private readonly http = inject(HttpClient);

  getExecutive(): Observable<ExecutiveDashboardPayload> {
    return this.http
      .get<{ success: boolean; data: ExecutiveDashboardPayload }>(
        `${environment.apiUrl}/tenant/dashboard/executive`
      )
      .pipe(map((res) => res.data));
  }
}
