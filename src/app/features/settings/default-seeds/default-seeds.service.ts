import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '@environments/environment';
import {
  ApiEnvelope,
  DefaultSeedCatalogPayload,
  DefaultSeedExecutionPayload,
} from './default-seeds.model';

@Injectable({ providedIn: 'root' })
export class DefaultSeedsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/tenant/default-seeds`;

  getCatalog(): Observable<DefaultSeedCatalogPayload> {
    return this.http
      .get<ApiEnvelope<DefaultSeedCatalogPayload>>(this.base)
      .pipe(map((res) => res.data));
  }

  execute(ids: string[]): Observable<DefaultSeedExecutionPayload> {
    return this.http
      .post<ApiEnvelope<DefaultSeedExecutionPayload>>(this.base, { ids })
      .pipe(map((res) => res.data));
  }
}
