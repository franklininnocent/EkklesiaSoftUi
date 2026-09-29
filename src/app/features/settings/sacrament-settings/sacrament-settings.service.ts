import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import {
  TenantSacramentSettingUpdateResponse,
  TenantSacramentSettingsResponse,
} from './sacrament-settings.model';

@Injectable({ providedIn: 'root' })
export class SacramentSettingsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/tenant/sacrament-settings`;

  list(): Observable<TenantSacramentSettingsResponse> {
    return this.http.get<TenantSacramentSettingsResponse>(this.base);
  }

  update(
    sacramentTypeId: number,
    isActive: boolean
  ): Observable<TenantSacramentSettingUpdateResponse> {
    return this.http.patch<TenantSacramentSettingUpdateResponse>(
      `${this.base}/${sacramentTypeId}`,
      { is_active: isActive }
    );
  }
}
